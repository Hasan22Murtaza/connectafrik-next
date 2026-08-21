import { SupabaseClient } from '@supabase/supabase-js'
import { getSellerHoldDays } from './sellerTier'
import { appendOrderLedgerEntry } from './orderLedger'
import {
  isAutoPayoutEnabled,
  executeStripeConnectPayout,
  markPayoutProcessing,
  markPayoutWaiting,
} from './payoutTransfer'

const MAX_PAYOUT_RETRIES = 10

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

async function findPayoutByOrder(
  serviceClient: SupabaseClient,
  orderId: string
): Promise<{ id: string; status: string | null; retry_count: number | null } | null> {
  const { data } = await serviceClient
    .from('seller_payouts')
    .select('id, status, retry_count')
    .eq('order_id', orderId)
    .maybeSingle()

  if (!data?.id) return null
  return {
    id: data.id as string,
    status: (data.status as string | null) ?? null,
    retry_count: (data.retry_count as number | null) ?? 0,
  }
}

/**
 * Create (or reuse) a pending seller_payouts row as soon as payout is scheduled.
 * Unique(order_id) means failed rows are reused instead of inserting a second payout.
 */
async function ensurePendingSellerPayout(
  serviceClient: SupabaseClient,
  order: MarketplaceOrder
): Promise<string> {
  const sellerNet = computeSellerNet(order)
  const commission = computeCommission(order, sellerNet)
  const idempotencyKey = `order-${order.id}`

  const existingPayout = await findPayoutByOrder(serviceClient, order.id)
  if (existingPayout) {
    return existingPayout.id
  }

  const { data: payout, error: payoutError } = await serviceClient
    .from('seller_payouts')
    .insert({
      seller_id: order.seller_id,
      order_id: order.id,
      amount: sellerNet,
      commission_amount: commission,
      status: 'pending',
      gateway: 'stripe',
      hold_reason: 'delivery_confirmed',
      scheduled_release_at: order.release_eligible_at,
      idempotency_key: idempotencyKey,
      requested_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (payoutError) {
    if (payoutError.code === '23505') {
      const dup = await findPayoutByOrder(serviceClient, order.id)
      if (dup) return dup.id

      const { data: byKey } = await serviceClient
        .from('seller_payouts')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()

      if (byKey?.id) return byKey.id as string
    }
    throw new Error(payoutError.message)
  }

  if (!payout?.id) {
    throw new Error('Failed to create seller payout')
  }

  return payout.id as string
}

/** Backfill a pending seller_payouts row for an already-scheduled order. */
export async function ensureScheduledSellerPayout(
  serviceClient: SupabaseClient,
  orderId: string
): Promise<string | null> {
  const { data: order, error } = await serviceClient
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (error || !order) return null

  const typedOrder = order as MarketplaceOrder
  if (typedOrder.escrow_status !== 'scheduled') return null
  if (typedOrder.payout_status === 'completed') return null

  const existing = await findPayoutByOrder(serviceClient, orderId)
  if (existing?.status === 'cancelled') {
    await serviceClient
      .from('seller_payouts')
      .update({
        status: 'pending',
        hold_reason: 'delivery_confirmed',
        scheduled_release_at: typedOrder.release_eligible_at,
        notes: null,
        failure_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  }

  return ensurePendingSellerPayout(serviceClient, typedOrder)
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

  const payoutId = await ensurePendingSellerPayout(serviceClient, {
    ...typedOrder,
    escrow_status: 'scheduled',
    release_eligible_at: releaseEligibleAt.toISOString(),
  })

  return {
    success: true,
    order_id: orderId,
    payout_id: payoutId,
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

  const existing = await findPayoutByOrder(serviceClient, orderId)

  if (existing?.status === 'completed') {
    return { skipped: true, reason: 'already_paid', payout_id: existing.id }
  }

  if (existing?.status === 'cancelled') {
    return { skipped: true, reason: 'payout_cancelled', payout_id: existing.id }
  }

  if ((existing?.retry_count ?? 0) >= MAX_PAYOUT_RETRIES) {
    return { skipped: true, reason: 'max_retries', payout_id: existing?.id }
  }

  const sellerNet = computeSellerNet(typedOrder)
  const payoutId = existing?.id ?? (await ensurePendingSellerPayout(serviceClient, typedOrder))

  const autoPayout = isAutoPayoutEnabled()

  const { data: sellerProfile } = await serviceClient
    .from('profiles')
    .select('stripe_connect_account_id, stripe_connect_payouts_enabled')
    .eq('id', typedOrder.seller_id)
    .maybeSingle()

  const canStripeConnect = Boolean(
    sellerProfile?.stripe_connect_account_id && sellerProfile?.stripe_connect_payouts_enabled
  )

  if (!autoPayout) {
    await markPayoutWaiting(serviceClient, payoutId, 'Waiting for auto-payouts to be enabled')
    return {
      payout_id: payoutId,
      auto_payout: false,
      message: 'Payout queued — auto-payouts are disabled',
    }
  }

  if (!canStripeConnect) {
    await markPayoutWaiting(
      serviceClient,
      payoutId,
      'Waiting for seller Stripe Connect onboarding'
    )
    return {
      payout_id: payoutId,
      auto_payout: false,
      message: 'Payout queued — complete Stripe Connect onboarding to receive payouts',
    }
  }

  await markPayoutProcessing(serviceClient, payoutId)
  await serviceClient
    .from('orders')
    .update({
      payout_status: 'processing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  const transfer = await executeStripeConnectPayout(serviceClient, {
    payout_id: payoutId,
    seller_id: typedOrder.seller_id,
    amount: sellerNet,
    order_id: orderId,
    currency: typedOrder.currency,
  })

  if (transfer.success) {
    await appendOrderLedgerEntry(serviceClient, {
      order_id: orderId,
      entry_type: 'escrow_released',
      amount: sellerNet,
      currency: typedOrder.currency,
      reference_type: 'seller_payouts',
      reference_id: payoutId,
    })
  }

  return { payout_id: payoutId, transfer, auto_payout: true, gateway: 'stripe_connect' }
}

export async function processEscrowReleases(serviceClient: SupabaseClient) {
  const now = new Date().toISOString()

  const { data: scheduledOrders, error: scheduledError } = await serviceClient
    .from('orders')
    .select('id')
    .eq('escrow_status', 'scheduled')
    .not('payout_status', 'eq', 'completed')

  if (scheduledError) {
    throw new Error(scheduledError.message)
  }

  const backfilled: Array<{ order_id: string; payout_id?: string; error?: string }> = []
  for (const row of scheduledOrders ?? []) {
    try {
      const payoutId = await ensureScheduledSellerPayout(serviceClient, row.id)
      if (payoutId) backfilled.push({ order_id: row.id, payout_id: payoutId })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      backfilled.push({ order_id: row.id, error: message })
    }
  }

  const dueOrderIds = new Set<string>()

  const { data: duePayouts, error: duePayoutsError } = await serviceClient
    .from('seller_payouts')
    .select('order_id, status, retry_count')
    .in('status', ['pending', 'approved', 'failed', 'processing'])
    .lte('scheduled_release_at', now)

  if (duePayoutsError) {
    throw new Error(duePayoutsError.message)
  }

  for (const payout of duePayouts ?? []) {
    if ((payout.retry_count ?? 0) >= MAX_PAYOUT_RETRIES) continue
    if (payout.order_id) dueOrderIds.add(payout.order_id as string)
  }

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

  for (const row of orders ?? []) {
    dueOrderIds.add(row.id)
  }

  const results: Array<{ order_id: string; result: unknown }> = []

  for (const orderId of dueOrderIds) {
    try {
      const result = await releaseOrderEscrow(serviceClient, orderId)
      results.push({ order_id: orderId, result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results.push({ order_id: orderId, result: { error: message } })
    }
  }

  return {
    processed: results.length,
    backfilled: backfilled.length,
    results,
  }
}
