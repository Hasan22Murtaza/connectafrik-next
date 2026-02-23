import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json()

    const { payout_id, seller_id, amount, order_id } = body
    if (!payout_id || !seller_id || !amount || !order_id) {
      return errorResponse('payout_id, seller_id, amount, and order_id are required', 400)
    }

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
      return errorResponse('Seller not found', 404)
    }

    const payoutMethod = seller.payout_method || 'bank'
    let recipientCode: string
    let transferMethod: string

    if (payoutMethod === 'bank') {
      if (!seller.bank_name || !seller.account_number || !seller.account_name || !seller.bank_code) {
        return errorResponse('Seller has incomplete bank details', 400)
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
          return errorResponse('Failed to create bank recipient', 500)
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
        return errorResponse('Seller has incomplete mobile money details', 400)
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
          return errorResponse('Failed to create mobile money recipient', 500)
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
      await serviceClient
        .from('seller_payouts')
        .update({ status: 'failed', notes: 'Transfer failed', updated_at: new Date().toISOString() })
        .eq('id', payout_id)
      return errorResponse('Transfer failed', 500)
    }

    const transfer = transferData.data

    await serviceClient
      .from('seller_payouts')
      .update({
        status: transfer.status === 'success' ? 'completed' : 'processing',
        payout_reference: transfer.reference,
        payout_method: transferMethod,
        processed_at: transfer.status === 'success' ? new Date().toISOString() : null,
        notes: `Automated ${transferMethod}: ${transfer.status}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payout_id)

    if (transfer.status === 'success') {
      await serviceClient
        .from('orders')
        .update({
          payout_status: 'completed',
          paid_to_seller_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order_id)
    }

    if (payoutMethod === 'mobile_money') {
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
        paystack_reference: transfer.reference,
        status: transfer.status === 'success' ? 'success' : 'pending',
      })
    }

    return jsonResponse({
      success: true,
      transfer_code: transfer.transfer_code,
      reference: transfer.reference,
      status: transfer.status,
      method: transferMethod,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
