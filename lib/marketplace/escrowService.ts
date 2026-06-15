import { SupabaseClient } from '@supabase/supabase-js'
import { getSellerHoldDays } from './sellerTier'
import { appendOrderLedgerEntry } from './orderLedger'
import { isAutoPayoutEnabled, executeStripeConnectPayout } from './payoutTransfer'

interface MarketplaceOrder {
  id: string
  buyer_id: string
  seller_id: string
  total_amount: number
  currency: string
  payment_status: string
  status: string
  escrow_status: string | null
  payout_status: string | null
  seller_net_amount: number | null
  platform_commission_amount: number | null
  platform_commission_rate: number | null
  payment_gateway: string | null
  release_eligible_at: string | null
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function computeSellerNet(order: MarketplaceOrder): number {
  if (order.seller_net_amount != null) return Number(order.seller_net_amount)
  const rate = order.platform_commission_rate ?? 0.05
  return Math.round(order.total_amount * (1 - rate) * 100) / 100
}

function computeCommission(order: MarketplaceOrder, sellerNet: number): number {
  if (order.platform_commission_amount != null) return Number(order.platform_commission_amount)
  return Math.round((order.total_amount - sellerNet) * 100) / 100
}

export async function confirmDeliveryWithHold(
  serviceClient: SupabaseClient,
  orderId: string,
  confirmedBy: string,
  trackingNumber?: string | null
) {
  const { data: order, error: orderError } = await serviceClient
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    throw new Error('Order not found')
  }

  const typedOrder = order as MarketplaceOrder

  if (typedOrder.buyer_id !== confirmedBy) {
    throw new Error('Only the buyer can confirm delivery')
  }

  if (typedOrder.payment_status !== 'completed') {
    throw new Error('Order payment is not completed')
  }

  if (typedOrder.escrow_status === 'scheduled' || typedOrder.escrow_status === 'released') {
    throw new Error('Delivery has already been confirmed for this order')
  }

  if (typedOrder.escrow_status === 'frozen') {
    throw new Error('Payout is frozen due to an open dispute')
  }

  if (typedOrder.payout_status === 'completed') {
    throw new Error('Seller has already been paid for this order')
  }

  if (typedOrder.status === 'cancelled' || typedOrder.status === 'refunded') {
    throw new Error('This order has been cancelled or refunded')
  }

  const { tier, holdDays } = await getSellerHoldDays(serviceClient, typedOrder.seller_id)
  const now = new Date()
  const releaseEligibleAt = addDays(now, holdDays)

  const updatePayload: Record<string, unknown> = {
    status: 'completed',
    delivery_status: 'delivered',
    escrow_status: 'scheduled',
    release_scheduled_at: now.toISOString(),
    release_eligible_at: releaseEligibleAt.toISOString(),
    delivery_confirmed_at: now.toISOString(),
    delivery_confirmed_by: confirmedBy,
    updated_at: now.toISOString(),
  }

  if (trackingNumber) {
    updatePayload.notes = trackingNumber
  }

  const { error: updateError } = await serviceClient
    .from('orders')
    .update(updatePayload)
    .eq('id', orderId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  await appendOrderLedgerEntry(serviceClient, {
    order_id: orderId,
    entry_type: 'adjustment',
    amount: 0,
    currency: typedOrder.currency,
    metadata: {
      action: 'delivery_confirmed',
      seller_tier: tier,
      hold_days: holdDays,
      release_eligible_at: releaseEligibleAt.toISOString(),
      tracking_number: trackingNumber ?? null,
    },
    created_by: confirmedBy,
  })

  if (holdDays === 0) {
    const releaseResult = await releaseOrderEscrow(serviceClient, orderId)
    return {
      success: true,
      order_id: orderId,
      seller_tier: tier,
      hold_days: holdDays,
      release_eligible_at: releaseEligibleAt.toISOString(),
      release: releaseResult,
      message: 'Delivery confirmed. Payout is being processed.',
    }
  }

  return {
    success: true,
    order_id: orderId,
    seller_tier: tier,
    hold_days: holdDays,
    release_eligible_at: releaseEligibleAt.toISOString(),
    message: `Delivery confirmed. Payout scheduled after ${holdDays} day${holdDays === 1 ? '' : 's'}.`,
  }
}

export async function releaseOrderEscrow(
  serviceClient: SupabaseClient,
  orderId: string
) {
  const { data: order, error } = await serviceClient
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (error || !order) {
    throw new Error('Order not found')
  }

  const typedOrder = order as MarketplaceOrder

  if (typedOrder.escrow_status === 'frozen') {
    return { skipped: true, reason: 'dispute_frozen' }
  }

  if (typedOrder.payout_status === 'completed') {
    return { skipped: true, reason: 'already_paid' }
  }

  const sellerNet = computeSellerNet(typedOrder)
  const commission = computeCommission(typedOrder, sellerNet)
  const idempotencyKey = `order-${orderId}`

  const { data: existingPayout } = await serviceClient
    .from('seller_payouts')
    .select('id, status')
    .eq('order_id', orderId)
    .not('status', 'in', '(failed,cancelled)')
    .maybeSingle()

  let payoutId = existingPayout?.id as string | undefined

  if (!payoutId) {
    const { data: payout, error: payoutError } = await serviceClient
      .from('seller_payouts')
      .insert({
        seller_id: typedOrder.seller_id,
        order_id: orderId,
        amount: sellerNet,
        commission_amount: commission,
        status: 'pending',
        gateway: 'stripe',
        hold_reason: 'delivery_confirmed',
        scheduled_release_at: typedOrder.release_eligible_at,
        idempotency_key: idempotencyKey,
        requested_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (payoutError) {
      if (payoutError.code === '23505') {
        const { data: dup } = await serviceClient
          .from('seller_payouts')
          .select('id')
          .eq('order_id', orderId)
          .maybeSingle()
        payoutId = dup?.id
      } else {
        throw new Error(payoutError.message)
      }
    } else {
      payoutId = payout?.id
    }
  }

  if (!payoutId) {
    throw new Error('Failed to create seller payout')
  }

  const autoPayout = isAutoPayoutEnabled()

  const { data: sellerProfile } = await serviceClient
    .from('profiles')
    .select('stripe_connect_account_id, stripe_connect_payouts_enabled')
    .eq('id', typedOrder.seller_id)
    .maybeSingle()

  const canStripeConnect = Boolean(
    sellerProfile?.stripe_connect_account_id && sellerProfile?.stripe_connect_payouts_enabled
  )

  await serviceClient
    .from('orders')
    .update({
      escrow_status: 'released',
      payout_status: autoPayout && canStripeConnect ? 'processing' : 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  await appendOrderLedgerEntry(serviceClient, {
    order_id: orderId,
    entry_type: 'escrow_released',
    amount: sellerNet,
    currency: typedOrder.currency,
    reference_type: 'seller_payouts',
    reference_id: payoutId,
  })

  if (autoPayout && canStripeConnect) {
    const transfer = await executeStripeConnectPayout(serviceClient, {
      payout_id: payoutId,
      seller_id: typedOrder.seller_id,
      amount: sellerNet,
      order_id: orderId,
      currency: typedOrder.currency,
    })

    return { payout_id: payoutId, transfer, auto_payout: true, gateway: 'stripe_connect' }
  }

  await serviceClient
    .from('seller_payouts')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', payoutId)

  return {
    payout_id: payoutId,
    auto_payout: false,
    message: 'Payout queued — complete Stripe Connect onboarding to receive payouts',
  }
}

export async function processEscrowReleases(serviceClient: SupabaseClient) {
  const now = new Date().toISOString()

  const { data: orders, error } = await serviceClient
    .from('orders')
    .select('id')
    .eq('escrow_status', 'scheduled')
    .is('dispute_id', null)
    .lte('release_eligible_at', now)
    .not('payout_status', 'eq', 'completed')

  if (error) {
    throw new Error(error.message)
  }

  const results: Array<{ order_id: string; result: unknown }> = []

  for (const row of orders ?? []) {
    try {
      const result = await releaseOrderEscrow(serviceClient, row.id)
      results.push({ order_id: row.id, result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results.push({ order_id: row.id, result: { error: message } })
    }
  }

  return {
    processed: results.length,
    results,
  }
}
