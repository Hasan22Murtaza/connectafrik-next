import { apiClient } from '@/lib/api-client'

export interface AdminDashboardSummary {
  revenue: Record<string, unknown> | null
  gmv_by_currency: Record<string, number>
  orders_by_status: Record<string, number>
  total_orders: number
  payouts_by_status: Record<string, number>
  payouts_by_gateway: Record<string, number>
  total_payouts: number
  open_disputes: number
  dispute_sla_breaches: number
  total_refunds: number
  refunds_by_currency: Record<string, number>
  open_chargebacks: number
  escrow_by_currency: Record<string, number>
  recent_orders: Array<{
    id: string
    status: string
    currency: string
    total_amount: number
    escrow_status: string
    payout_status: string
    created_at: string
  }>
}

export async function getAdminDashboard(): Promise<AdminDashboardSummary> {
  const result = await apiClient.get<{ data: AdminDashboardSummary }>(
    '/api/marketplace/admin/dashboard'
  )
  return result.data
}

export async function startStripeConnectOnboarding(): Promise<{ url: string }> {
  const result = await apiClient.post<{ data: { url: string } }>(
    '/api/marketplace/seller/stripe-connect/onboard',
    {}
  )
  return result.data
}

export async function getStripeConnectStatus() {
  const result = await apiClient.get<{ data: Record<string, unknown> }>(
    '/api/marketplace/seller/stripe-connect/status'
  )
  return result.data
}
