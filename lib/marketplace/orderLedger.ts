import { SupabaseClient } from '@supabase/supabase-js'
import type { OrderFinancialFields } from './orderFinancials'

export type LedgerEntryType =
  | 'payment_captured'
  | 'commission_deducted'
  | 'gateway_fee_allocated'
  | 'escrow_held'
  | 'escrow_released'
  | 'payout_initiated'
  | 'payout_completed'
  | 'refund_issued'
  | 'refund_partial'
  | 'dispute_freeze'
  | 'dispute_unfreeze'
  | 'chargeback'
  | 'adjustment'

interface LedgerEntryInput {
  order_id: string
  entry_type: LedgerEntryType
  amount: number
  currency: string
  balance_after?: number | null
  reference_type?: string | null
  reference_id?: string | null
  metadata?: Record<string, unknown>
  created_by?: string | null
}

export async function appendOrderLedgerEntry(
  client: SupabaseClient,
  entry: LedgerEntryInput
): Promise<void> {
  const { error } = await client.from('order_ledger').insert({
    order_id: entry.order_id,
    entry_type: entry.entry_type,
    amount: entry.amount,
    currency: entry.currency,
    balance_after: entry.balance_after ?? null,
    reference_type: entry.reference_type ?? null,
    reference_id: entry.reference_id ?? null,
    metadata: entry.metadata ?? {},
    created_by: entry.created_by ?? null,
  })

  if (error) {
    console.error('order_ledger insert failed:', error.message, entry)
  }
}

export async function recordCheckoutLedger(
  client: SupabaseClient,
  orderId: string,
  currency: string,
  totalAmount: number,
  financials: OrderFinancialFields,
  createdBy?: string | null
): Promise<void> {
  const sellerNet = financials.seller_net_amount

  await appendOrderLedgerEntry(client, {
    order_id: orderId,
    entry_type: 'payment_captured',
    amount: totalAmount,
    currency,
    balance_after: totalAmount,
    created_by: createdBy,
  })

  if (financials.platform_commission_amount > 0) {
    await appendOrderLedgerEntry(client, {
      order_id: orderId,
      entry_type: 'commission_deducted',
      amount: financials.platform_commission_amount,
      currency,
      balance_after: totalAmount - financials.platform_commission_amount,
      created_by: createdBy,
    })
  }

  if (financials.gateway_fee_total > 0) {
    await appendOrderLedgerEntry(client, {
      order_id: orderId,
      entry_type: 'gateway_fee_allocated',
      amount: financials.gateway_fee_total,
      currency,
      metadata: {
        platform_share: financials.gateway_fee_platform_share,
        seller_share: financials.gateway_fee_seller_share,
      },
      created_by: createdBy,
    })
  }

  await appendOrderLedgerEntry(client, {
    order_id: orderId,
    entry_type: 'escrow_held',
    amount: sellerNet,
    currency,
    balance_after: sellerNet,
    metadata: { escrow_status: 'held' },
    created_by: createdBy,
  })
}
