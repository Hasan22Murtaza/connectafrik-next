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

export interface AdminOrder {
  id: string
  order_number: string
  product_title: string
  total_amount: number
  currency: string
  status: string
  payment_status: string
  escrow_status: string | null
  payout_status: string | null
  buyer_id: string
  seller_id: string
  created_at: string
}

export interface AdminPayout {
  id: string
  seller_id: string
  order_id: string
  amount: number
  commission_amount?: number
  currency?: string
  gateway?: string
  payout_method: string
  payout_reference?: string
  status: string
  notes?: string
  requested_at: string
  processed_at?: string
  created_at: string
}

export interface PaginatedResult<T> {
  data: T[]
  count: number
  page: number
  limit: number
}

export async function getAdminDashboard(): Promise<AdminDashboardSummary> {
  const result = await apiClient.get<{ data: AdminDashboardSummary }>(
    '/api/marketplace/admin/dashboard'
  )
  return result.data
}

export async function listAdminOrders(params?: {
  status?: string
  escrow_status?: string
  page?: number
  limit?: number
}): Promise<PaginatedResult<AdminOrder>> {
  const result = await apiClient.get<PaginatedResult<AdminOrder>>(
    '/api/marketplace/admin/orders',
    params
  )
  return result
}

export async function listAdminPayouts(params?: {
  status?: string
  page?: number
  limit?: number
}): Promise<PaginatedResult<AdminPayout>> {
  const result = await apiClient.get<PaginatedResult<AdminPayout>>(
    '/api/marketplace/admin/payouts',
    params
  )
  return result
}

export async function issueOrderRefund(
  orderId: string,
  params: { amount?: number; reason?: string; mark_cancelled?: boolean }
) {
  const result = await apiClient.post<{ data: unknown }>(
    `/api/marketplace/orders/${orderId}/refund`,
    params
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
