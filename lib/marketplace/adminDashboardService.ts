import { SupabaseClient } from '@supabase/supabase-js'

const emptyDashboard = {
  revenue: null,
  gmv_by_currency: {} as Record<string, number>,
  orders_by_status: {} as Record<string, number>,
  total_orders: 0,
  payouts_by_status: {} as Record<string, number>,
  payouts_by_gateway: {} as Record<string, number>,
  total_payouts: 0,
  open_disputes: 0,
  dispute_sla_breaches: 0,
  total_refunds: 0,
  refunds_by_currency: {} as Record<string, number>,
  open_chargebacks: 0,
  escrow_by_currency: {} as Record<string, number>,
  recent_orders: [] as Array<{
    id: string
    status: string
    currency: string
    total_amount: number
    escrow_status: string
    payout_status: string
    created_at: string
  }>,
}

export async function getAdminDashboardSummary(_serviceClient: SupabaseClient) {
  return emptyDashboard
}

export async function listAdminOrders(
  _serviceClient: SupabaseClient,
  filters: {
    status?: string
    escrow_status?: string
    page?: number
    limit?: number
  }
) {
  const page = filters.page ?? 0
  const limit = Math.min(filters.limit ?? 20, 100)
  return { data: [], count: 0, page, limit }
}

export async function getAdminOrderDetail(_serviceClient: SupabaseClient, _orderId: string) {
  throw new Error('Order not found')
}

export async function listAdminPayouts(
  _serviceClient: SupabaseClient,
  filters: { status?: string; page?: number; limit?: number }
) {
  const page = filters.page ?? 0
  const limit = Math.min(filters.limit ?? 20, 100)
  return { data: [], count: 0, page, limit }
}
