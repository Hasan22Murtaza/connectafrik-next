import { apiClient } from '@/lib/api-client'
import { calculateStripeFees } from './stripeService'

export interface CommissionCalculation {
  total_amount: number
  commission_rate: number
  commission_amount: number
  seller_payout: number
  gateway_fee?: number
  platform_fee_share?: number
  seller_fee_share?: number
  payment_gateway?: 'stripe'
}

export interface SellerPayout {
  id: string
  seller_id: string
  order_id: string
  amount: number
  commission_amount: number
  payout_method: string
  payout_reference?: string
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled'
  notes?: string
  requested_at: string
  processed_at?: string
  created_at: string
  updated_at: string
}

export interface SellerEarnings {
  seller_id: string
  username: string
  full_name: string
  total_orders: number
  total_sales: number
  total_commission_paid: number
  total_earnings: number
  paid_out: number
  pending_payout: number
  awaiting_delivery: number
}

/**
 * Calculate commission breakdown for an order (Stripe gateway).
 */
export function calculateCommission(
  totalAmount: number,
  currency: string = 'USD',
  commissionRate: number = 0.05
): CommissionCalculation {
  const stripeFees = calculateStripeFees(totalAmount, currency)
  const gateway_fee = stripeFees.gateway_fee
  const platform_fee_share = stripeFees.platform_fee_share
  const seller_fee_share = stripeFees.seller_fee_share

  const commission_amount = Math.round((totalAmount * commissionRate - platform_fee_share) * 100) / 100
  const seller_payout = Math.round((totalAmount * (1 - commissionRate) - seller_fee_share) * 100) / 100

  return {
    total_amount: totalAmount,
    commission_rate: commissionRate,
    commission_amount,
    seller_payout,
    gateway_fee,
    platform_fee_share,
    seller_fee_share,
    payment_gateway: 'stripe',
  }
}

/**
 * Confirm delivery of an order
 * This marks the order as delivered and creates a payout record for the seller
 * If auto-payouts are enabled, this triggers automatic transfer to seller's bank account
 */
export async function confirmDelivery(
  orderId: string,
  _confirmedBy: string,
  trackingNumber?: string
): Promise<{
  success: boolean
  order_id: string
  seller_payout?: number
  status?: string
  message?: string
  hold_days?: number
  release_eligible_at?: string
}> {
  try {
    const result = await apiClient.post<{ data: any }>(
      `/api/marketplace/orders/${orderId}/confirm-delivery`,
      { tracking_number: trackingNumber }
    )
    return result.data
  } catch (error) {
    console.error('Error confirming delivery:', error)
    throw error
  }
}

/**
 * Process a seller payout
 * This marks the payout as completed and records the payment reference
 */
export async function processSellerPayout(
  payoutId: string,
  payoutReference: string,
  notes?: string
): Promise<{ success: boolean; payout_id: string; status: string }> {
  try {
    const result = await apiClient.post<{ data: any }>(
      `/api/marketplace/payouts/${payoutId}/process`,
      { payout_reference: payoutReference, notes }
    )
    return result.data
  } catch (error) {
    console.error('Error processing payout:', error)
    throw error
  }
}

/**
 * Get seller earnings summary
 */
export async function getSellerEarnings(sellerId: string): Promise<SellerEarnings | null> {
  try {
    const result = await apiClient.get<{ data: SellerEarnings }>('/api/marketplace/earnings')
    return result.data
  } catch (error) {
    console.error('Error fetching seller earnings:', error)
    return null
  }
}

/**
 * Get all payouts for a seller
 */
export async function getSellerPayouts(
  sellerId: string,
  status?: SellerPayout['status']
): Promise<SellerPayout[]> {
  try {
    const allPayouts: SellerPayout[] = []
    let page = 0
    let hasMore = true

    while (hasMore) {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (status) params.status = status

      const result = await apiClient.get<{ data: SellerPayout[]; hasMore?: boolean }>(
        '/api/marketplace/payouts',
        params
      )

      const pagePayouts = result.data || []
      allPayouts.push(...pagePayouts)
      hasMore = Boolean(result.hasMore)
      page += 1

      if (pagePayouts.length === 0) break
    }

    return allPayouts
  } catch (error) {
    console.error('Error fetching seller payouts:', error)
    return []
  }
}

/**
 * Get pending payouts (admin function)
 */
export async function getPendingPayouts(): Promise<SellerPayout[]> {
  try {
    const allPayouts: SellerPayout[] = []
    let page = 0
    let hasMore = true

    while (hasMore) {
      const result = await apiClient.get<{ data: SellerPayout[]; hasMore?: boolean }>(
        '/api/admin/pending-payouts',
        { page, limit: 20 }
      )
      const pagePayouts = result.data || []
      allPayouts.push(...pagePayouts)
      hasMore = Boolean(result.hasMore)
      page += 1

      if (pagePayouts.length === 0) break
    }

    return allPayouts
  } catch (error) {
    console.error('Error fetching pending payouts:', error)
    return []
  }
}

/**
 * Get platform revenue summary (admin function)
 */
export async function getPlatformRevenue(): Promise<{
  total_orders: number
  total_gmv: number
  total_commission_revenue: number
  realized_revenue: number
  pending_revenue: number
  avg_commission_per_order: number
  active_sellers: number
  active_buyers: number
} | null> {
  try {
    const result = await apiClient.get<{ data: any }>('/api/admin/revenue')
    return result.data
  } catch (error) {
    console.error('Error fetching platform revenue:', error)
    return null
  }
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}
