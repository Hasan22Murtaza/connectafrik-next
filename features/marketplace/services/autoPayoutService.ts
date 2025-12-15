import { supabase } from '@/lib/supabase'
import { createTransferRecipient, initiateTransfer } from '@/features/marketplace/services/paystackTransferService'
import { createMobileMoneyRecipient } from '@/features/marketplace/services/paystackMobileMoneyService'

interface AutoPayoutData {
  payout_id: string
  seller_id: string
  amount: number
  order_id: string
}

/**
 * Process automated payout to seller (supports both bank and mobile money)
 */
export async function processAutoPayout(data: AutoPayoutData) {
  const { payout_id, seller_id, amount, order_id } = data

  try {
    // 1. Get seller payout details
    const { data: seller, error: sellerError } = await supabase
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
      throw new Error('Seller not found')
    }

    const payoutMethod = seller.payout_method || 'bank'
    let recipientCode: string
    let transferMethod: string

    // 2. Handle Bank Transfer
    if (payoutMethod === 'bank') {
      // Validate seller has complete bank details
      if (!seller.bank_name || !seller.account_number || !seller.account_name || !seller.bank_code) {
        throw new Error('Seller has incomplete bank details. Please update profile.')
      }

      // Create bank recipient if not exists
      recipientCode = seller.paystack_recipient_code || ''

      if (!recipientCode) {
        const recipient = await createTransferRecipient({
          type: 'nuban',
          name: seller.account_name,
          account_number: seller.account_number,
          bank_code: seller.bank_code,
          currency: 'NGN'
        })

        recipientCode = recipient.recipient_code

        // Save recipient code for future use
        await supabase
          .from('profiles')
          .update({ paystack_recipient_code: recipientCode })
          .eq('id', seller_id)
      }

      transferMethod = 'bank_transfer'
    }
    // 3. Handle Mobile Money
    else {
      // Validate seller has complete mobile money details
      if (!seller.mobile_money_phone || !seller.mobile_money_provider_code || !seller.mobile_money_account_name) {
        throw new Error('Seller has incomplete mobile money details. Please update profile.')
      }

      // Create mobile money recipient if not exists
      recipientCode = seller.paystack_momo_recipient_code || ''

      if (!recipientCode) {
        const recipient = await createMobileMoneyRecipient({
          type: 'mobile_money',
          name: seller.mobile_money_account_name,
          phone: seller.mobile_money_phone,
          currency: seller.mobile_money_country === 'GH' ? 'GHS' :
                    seller.mobile_money_country === 'KE' ? 'KES' : 'NGN',
          provider_code: seller.mobile_money_provider_code
        })

        recipientCode = recipient.recipient_code

        // Save recipient code for future use
        await supabase
          .from('profiles')
          .update({ paystack_momo_recipient_code: recipientCode })
          .eq('id', seller_id)
      }

      transferMethod = 'mobile_money'
    }

    // 4. Initiate transfer (works for both bank and mobile money)
    const reference = `PAYOUT-${payout_id.slice(0, 8)}-${Date.now()}`

    const transfer = await initiateTransfer({
      source: 'balance',
      amount: Math.round(amount * 100), // Convert to kobo/pesewas/cents
      recipient: recipientCode,
      reason: `Seller payout for order ${order_id.slice(0, 8)}`,
      reference
    })

    // 5. Update payout record
    await supabase
      .from('seller_payouts')
      .update({
        status: transfer.status === 'success' ? 'completed' : 'processing',
        payout_reference: transfer.reference,
        payout_method: transferMethod,
        processed_at: transfer.status === 'success' ? new Date().toISOString() : null,
        notes: `Automated ${transferMethod}: ${transfer.status}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', payout_id)

    // 6. Update order
    if (transfer.status === 'success') {
      await supabase
        .from('orders')
        .update({
          payout_status: 'completed',
          paid_to_seller_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', order_id)
    }

    // 7. Log mobile money transaction
    if (payoutMethod === 'mobile_money') {
      await supabase
        .from('mobile_money_transactions')
        .insert({
          user_id: seller_id,
          transaction_type: 'payout',
          order_id: null,
          payout_id: payout_id,
          amount: amount,
          currency: seller.mobile_money_country === 'GH' ? 'GHS' :
                    seller.mobile_money_country === 'KE' ? 'KES' : 'NGN',
          phone: seller.mobile_money_phone,
          provider: seller.mobile_money_provider,
          provider_code: seller.mobile_money_provider_code,
          paystack_reference: transfer.reference,
          status: transfer.status === 'success' ? 'success' : 'pending'
        })
    }

    return {
      success: true,
      transfer_code: transfer.transfer_code,
      reference: transfer.reference,
      status: transfer.status,
      method: transferMethod
    }
  } catch (error: any) {
    console.error('Auto-payout error:', error)

    // Mark payout as failed
    await supabase
      .from('seller_payouts')
      .update({
        status: 'failed',
        notes: `Auto-payout failed: ${error.message}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', payout_id)

    throw error
  }
}

/**
 * Listen for auto-payout events (using Supabase Realtime)
 */
export function startAutoPayoutListener() {
  const channel = supabase.channel('auto_payout_channel')

  channel
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'seller_payouts',
      filter: 'status=eq.processing'
    }, async (payload) => {
      console.log('New payout detected:', payload.new)

      const payout = payload.new as any

      // Process auto-payout
      try {
        await processAutoPayout({
          payout_id: payout.id,
          seller_id: payout.seller_id,
          amount: payout.amount,
          order_id: payout.order_id
        })
        console.log(`✅ Successfully processed payout ${payout.id}`)
      } catch (error: any) {
        console.error(`❌ Failed to process payout ${payout.id}:`, error)
      }
    })
    .subscribe()

  console.log('🤖 Auto-payout listener started (Bank + Mobile Money)')

  return channel
}
