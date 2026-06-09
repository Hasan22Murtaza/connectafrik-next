import { SupabaseClient } from '@supabase/supabase-js'
import { appendOrderLedgerEntry } from './orderLedger'
import { getPlatformSetting } from './platformSettings'

interface ChargebackPayload {
  gateway: 'stripe' | 'paystack'
  gateway_dispute_id: string
  payment_reference?: string
  amount: number
  currency: string
  status: string
  reason?: string
  metadata?: Record<string, unknown>
}

async function debitSellerReserve(
  serviceClient: SupabaseClient,
  sellerId: string,
  amount: number,
  currency: string,
  referenceType: string,
  referenceId: string,
  notes: string
) {
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('seller_reserve_balance')
    .eq('id', sellerId)
    .single()

  const currentBalance = Number(profile?.seller_reserve_balance ?? 0)
  const newBalance = Math.round((currentBalance - amount) * 100) / 100

  await serviceClient
    .from('profiles')
    .update({
      seller_reserve_balance: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sellerId)

  await serviceClient.from('seller_reserve_ledger').insert({
    seller_id: sellerId,
    entry_type: 'chargeback_debit',
    amount: -amount,
    currency,
    balance_after: newBalance,
    reference_type: referenceType,
    reference_id: referenceId,
    notes,
  })

  return newBalance
}

export async function handleChargebackEvent(
  serviceClient: SupabaseClient,
  payload: ChargebackPayload
) {
  const { data: existing } = await serviceClient
    .from('chargeback_events')
    .select('id, status')
    .eq('gateway', payload.gateway)
    .eq('gateway_dispute_id', payload.gateway_dispute_id)
    .maybeSingle()

  let orderId: string | null = null
  let sellerId: string | null = null

  if (payload.payment_reference) {
    const { data: order } = await serviceClient
      .from('orders')
      .select('id, seller_id, total_amount, currency, seller_net_amount')
      .eq('payment_reference', payload.payment_reference)
      .maybeSingle()

    if (order) {
      orderId = order.id
      sellerId = order.seller_id
    }
  }

  const normalizedStatus =
    payload.status === 'won' || payload.status === 'warning_closed'
      ? 'won'
      : payload.status === 'lost'
        ? 'lost'
        : payload.status === 'under_review'
          ? 'under_review'
          : 'open'

  if (existing) {
    await serviceClient
      .from('chargeback_events')
      .update({
        status: normalizedStatus,
        updated_at: new Date().toISOString(),
        resolved_at:
          normalizedStatus === 'won' || normalizedStatus === 'lost'
            ? new Date().toISOString()
            : null,
      })
      .eq('id', existing.id)

    return { handled: true, action: 'updated', chargeback_id: existing.id }
  }

  const { data: chargeback, error } = await serviceClient
    .from('chargeback_events')
    .insert({
      order_id: orderId,
      seller_id: sellerId,
      gateway: payload.gateway,
      gateway_dispute_id: payload.gateway_dispute_id,
      payment_reference: payload.payment_reference,
      amount: payload.amount,
      currency: payload.currency,
      status: normalizedStatus,
      reason: payload.reason,
      metadata: payload.metadata ?? {},
    })
    .select('id')
    .single()

  if (error || !chargeback) {
    throw new Error(error?.message || 'Failed to record chargeback')
  }

  if (orderId && sellerId && normalizedStatus === 'open') {
    await serviceClient
      .from('orders')
      .update({
        escrow_status: 'frozen',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    await serviceClient
      .from('seller_payouts')
      .update({
        status: 'cancelled',
        notes: 'Frozen due to chargeback',
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)
      .in('status', ['pending', 'approved', 'processing'])

    const reserveRate = await getPlatformSetting(
      serviceClient,
      'chargeback_reserve_rate',
      0.05
    )
    const debitAmount = Math.round(payload.amount * reserveRate * 100) / 100

    if (debitAmount > 0) {
      await debitSellerReserve(
        serviceClient,
        sellerId,
        debitAmount,
        payload.currency,
        'chargeback_events',
        chargeback.id,
        `Chargeback reserve debit (${Math.round(reserveRate * 100)}%)`
      )

      await serviceClient
        .from('chargeback_events')
        .update({ seller_debited_amount: debitAmount })
        .eq('id', chargeback.id)
    }

    await appendOrderLedgerEntry(serviceClient, {
      order_id: orderId,
      entry_type: 'chargeback',
      amount: payload.amount,
      currency: payload.currency,
      reference_type: 'chargeback_events',
      reference_id: chargeback.id,
      metadata: { gateway_dispute_id: payload.gateway_dispute_id },
    })
  }

  return { handled: true, action: 'created', chargeback_id: chargeback.id }
}

export async function handleStripeDisputeWebhook(
  serviceClient: SupabaseClient,
  dispute: Record<string, unknown>
) {
  const paymentIntent = dispute.payment_intent as string | undefined
  const amount = Number(dispute.amount ?? 0) / 100
  const currency = String(dispute.currency ?? 'usd').toUpperCase()

  return handleChargebackEvent(serviceClient, {
    gateway: 'stripe',
    gateway_dispute_id: String(dispute.id),
    payment_reference: paymentIntent,
    amount,
    currency,
    status: String(dispute.status ?? 'open'),
    reason: dispute.reason as string | undefined,
    metadata: dispute as Record<string, unknown>,
  })
}
