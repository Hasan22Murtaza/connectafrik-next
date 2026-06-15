import type { SupabaseClient } from '@supabase/supabase-js'
import { appendOrderLedgerEntry } from './orderLedger'
import { createConnectTransfer, isStripeConnectEnabled } from './stripeConnect'

export interface PayoutTransferResult {
  success: boolean
  transfer_code?: string
  reference?: string
  status: string
  method?: string
  error?: string
}

interface ExecutePayoutParams {
  payout_id: string
  seller_id: string
  amount: number
  order_id: string
  currency?: string
}

export async function finalizeSuccessfulPayout(
  serviceClient: SupabaseClient,
  params: {
    payout_id: string
    order_id: string
    seller_id: string
    amount: number
    currency: string
    reference: string
    method?: string
  }
): Promise<void> {
  const { payout_id, order_id, amount, currency, reference, method } = params

  await serviceClient
    .from('seller_payouts')
    .update({
      status: 'completed',
      payout_reference: reference,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', payout_id)

  await serviceClient
    .from('orders')
    .update({
      payout_status: 'completed',
      escrow_status: 'released',
      paid_to_seller_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order_id)

  await appendOrderLedgerEntry(serviceClient, {
    order_id,
    entry_type: 'payout_completed',
    amount,
    currency,
    balance_after: 0,
    reference_type: 'seller_payouts',
    reference_id: payout_id,
    metadata: { reference, method },
  })
}

async function markPayoutFailed(
  serviceClient: SupabaseClient,
  payoutId: string,
  reason: string
): Promise<void> {
  await serviceClient
    .from('seller_payouts')
    .update({
      status: 'failed',
      failure_reason: reason,
      notes: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payoutId)
}

export async function executeStripeConnectPayout(
  serviceClient: SupabaseClient,
  params: ExecutePayoutParams
): Promise<PayoutTransferResult> {
  const { payout_id, seller_id, amount, order_id, currency = 'USD' } = params

  if (!isStripeConnectEnabled()) {
    await markPayoutFailed(serviceClient, payout_id, 'Stripe Connect not configured')
    return { success: false, status: 'failed', error: 'Stripe Connect not configured' }
  }

  const { data: seller, error: sellerError } = await serviceClient
    .from('profiles')
    .select('stripe_connect_account_id, stripe_connect_payouts_enabled')
    .eq('id', seller_id)
    .single()

  if (sellerError || !seller?.stripe_connect_account_id) {
    await markPayoutFailed(serviceClient, payout_id, 'Stripe Connect account not linked')
    return { success: false, status: 'failed', error: 'Seller has not completed Stripe Connect onboarding' }
  }

  if (!seller.stripe_connect_payouts_enabled) {
    await markPayoutFailed(serviceClient, payout_id, 'Stripe Connect payouts not enabled')
    return { success: false, status: 'failed', error: 'Stripe Connect payouts not enabled for seller' }
  }

  try {
    const transfer = await createConnectTransfer({
      amount,
      currency,
      destinationAccountId: seller.stripe_connect_account_id,
      orderId: order_id,
      payoutId: payout_id,
    })

    await serviceClient
      .from('seller_payouts')
      .update({
        status: 'completed',
        payout_reference: transfer.reference,
        payout_method: 'stripe_connect',
        gateway: 'stripe',
        processed_at: new Date().toISOString(),
        notes: 'Stripe Connect transfer',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payout_id)

    await finalizeSuccessfulPayout(serviceClient, {
      payout_id,
      order_id,
      seller_id,
      amount,
      currency,
      reference: transfer.reference,
      method: 'stripe_connect',
    })

    return {
      success: true,
      reference: transfer.reference,
      status: 'success',
      method: 'stripe_connect',
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Stripe Connect transfer failed'
    await markPayoutFailed(serviceClient, payout_id, message)
    return { success: false, status: 'failed', error: message }
  }
}

export function isAutoPayoutEnabled(): boolean {
  return (
    process.env.MARKETPLACE_AUTO_PAYOUTS === 'true' ||
    process.env.NEXT_PUBLIC_ENABLE_AUTO_PAYOUTS === 'true'
  )
}
