import { calculateCommission } from '@/features/marketplace/services/commissionService'

const DEFAULT_COMMISSION_RATE = 0.05

export interface OrderFinancialFields {
  platform_commission_rate: number
  platform_commission_amount: number
  gateway_fee_total: number
  gateway_fee_platform_share: number
  gateway_fee_seller_share: number
  seller_net_amount: number
  payment_gateway: 'stripe'
  escrow_status: 'held'
}

/**
 * Build persisted financial fields for a new marketplace order.
 * Used at checkout completion (Stripe).
 */
export function buildOrderFinancialFields(
  totalAmount: number,
  currency: string,
  paymentGateway: 'stripe' = 'stripe',
  commissionRate = DEFAULT_COMMISSION_RATE
): OrderFinancialFields {
  const breakdown = calculateCommission(totalAmount, currency, commissionRate)

  return {
    platform_commission_rate: breakdown.commission_rate,
    platform_commission_amount: breakdown.commission_amount,
    gateway_fee_total: breakdown.gateway_fee ?? 0,
    gateway_fee_platform_share: breakdown.platform_fee_share ?? 0,
    gateway_fee_seller_share: breakdown.seller_fee_share ?? 0,
    seller_net_amount: breakdown.seller_payout,
    payment_gateway: paymentGateway,
    escrow_status: 'held',
  }
}
