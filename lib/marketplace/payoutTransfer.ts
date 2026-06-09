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

export async function executePaystackPayout(
  serviceClient: SupabaseClient,
  params: ExecutePayoutParams
): Promise<PayoutTransferResult> {
  const { payout_id, seller_id, amount, order_id, currency = 'NGN' } = params

  const { data: seller, error: sellerError } = await serviceClient
    .from('profiles')
    .select(`
      payout_method,
      bank_name, account_number, account_name, bank_code, paystack_recipient_code,
      mobile_money_phone, mobile_money_provider, mobile_money_provider_code,
      mobile_money_account_name, mobile_money_country, paystack_momo_recipient_code
    `)
    .eq('id', seller_id)
    .single()

  if (sellerError || !seller) {
    await markPayoutFailed(serviceClient, payout_id, 'Seller not found')
    return { success: false, status: 'failed', error: 'Seller not found' }
  }

  const payoutMethod = seller.payout_method || 'bank'
  let recipientCode: string
  let transferMethod: string

  if (payoutMethod === 'bank') {
    if (!seller.bank_name || !seller.account_number || !seller.account_name || !seller.bank_code) {
      await markPayoutFailed(serviceClient, payout_id, 'Incomplete bank details')
      return { success: false, status: 'failed', error: 'Seller has incomplete bank details' }
    }

    recipientCode = seller.paystack_recipient_code || ''

    if (!recipientCode) {
      const { data: recipientData, error: recipientError } = await serviceClient.functions.invoke(
        'paystack-create-recipient',
        {
          body: {
            type: 'nuban',
            name: seller.account_name,
            account_number: seller.account_number,
            bank_code: seller.bank_code,
            currency: 'NGN',
          },
        }
      )

      if (recipientError || !recipientData?.data?.recipient_code) {
        await markPayoutFailed(serviceClient, payout_id, 'Failed to create bank recipient')
        return { success: false, status: 'failed', error: 'Failed to create bank recipient' }
      }

      recipientCode = recipientData.data.recipient_code
      await serviceClient
        .from('profiles')
        .update({ paystack_recipient_code: recipientCode })
        .eq('id', seller_id)
    }

    transferMethod = 'bank_transfer'
  } else {
    if (!seller.mobile_money_phone || !seller.mobile_money_provider_code || !seller.mobile_money_account_name) {
      await markPayoutFailed(serviceClient, payout_id, 'Incomplete mobile money details')
      return { success: false, status: 'failed', error: 'Seller has incomplete mobile money details' }
    }

    recipientCode = seller.paystack_momo_recipient_code || ''

    if (!recipientCode) {
      const momoCurrency =
        seller.mobile_money_country === 'GH' ? 'GHS' :
        seller.mobile_money_country === 'KE' ? 'KES' : 'NGN'

      const { data: recipientData, error: recipientError } = await serviceClient.functions.invoke(
        'paystack-create-recipient',
        {
          body: {
            type: 'mobile_money',
            name: seller.mobile_money_account_name,
            phone: seller.mobile_money_phone,
            currency: momoCurrency,
            provider: seller.mobile_money_provider_code,
          },
        }
      )

      if (recipientError || !recipientData?.data?.recipient_code) {
        await markPayoutFailed(serviceClient, payout_id, 'Failed to create mobile money recipient')
        return { success: false, status: 'failed', error: 'Failed to create mobile money recipient' }
      }

      recipientCode = recipientData.data.recipient_code
      await serviceClient
        .from('profiles')
        .update({ paystack_momo_recipient_code: recipientCode })
        .eq('id', seller_id)
    }

    transferMethod = 'mobile_money'
  }

  const reference = `PAYOUT-${payout_id.slice(0, 8)}-${Date.now()}`

  const { data: transferData, error: transferError } = await serviceClient.functions.invoke(
    'paystack-transfer',
    {
      body: {
        source: 'balance',
        amount: Math.round(amount * 100),
        recipient: recipientCode,
        reason: `Seller payout for order ${order_id.slice(0, 8)}`,
        reference,
      },
    }
  )

  if (transferError || !transferData?.data) {
    await markPayoutFailed(serviceClient, payout_id, 'Transfer API failed')
    return { success: false, status: 'failed', error: 'Transfer failed' }
  }

  const transfer = transferData.data
  const isSuccess = transfer.status === 'success'

  await serviceClient
    .from('seller_payouts')
    .update({
      status: isSuccess ? 'completed' : 'processing',
      payout_reference: transfer.reference,
      payout_method: transferMethod,
      gateway: 'paystack',
      processed_at: isSuccess ? new Date().toISOString() : null,
      notes: `Automated ${transferMethod}: ${transfer.status}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payout_id)

  await appendOrderLedgerEntry(serviceClient, {
    order_id,
    entry_type: 'payout_initiated',
    amount,
    currency,
    reference_type: 'seller_payouts',
    reference_id: payout_id,
    metadata: { reference: transfer.reference, method: transferMethod },
  })

  if (isSuccess) {
    await finalizeSuccessfulPayout(serviceClient, {
      payout_id,
      order_id,
      seller_id,
      amount,
      currency,
      reference: transfer.reference,
      method: transferMethod,
      seller,
      payoutMethod,
    })
  }

  return {
    success: true,
    transfer_code: transfer.transfer_code,
    reference: transfer.reference,
    status: transfer.status,
    method: transferMethod,
  }
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
    seller?: Record<string, unknown>
    payoutMethod?: string
  }
): Promise<void> {
  const { payout_id, order_id, seller_id, amount, currency, reference, method, seller, payoutMethod } = params

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

  if (payoutMethod === 'mobile_money' && seller) {
    const momoCurrency =
      seller.mobile_money_country === 'GH' ? 'GHS' :
      seller.mobile_money_country === 'KE' ? 'KES' : 'NGN'

    await serviceClient.from('mobile_money_transactions').insert({
      user_id: seller_id,
      transaction_type: 'payout',
      order_id: null,
      payout_id,
      amount,
      currency: momoCurrency,
      phone: seller.mobile_money_phone,
      provider: seller.mobile_money_provider,
      provider_code: seller.mobile_money_provider_code,
      paystack_reference: reference,
      status: 'success',
    })
  }
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
