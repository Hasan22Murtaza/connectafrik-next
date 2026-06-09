import { SupabaseClient } from '@supabase/supabase-js'
import { getOrderDispute } from './disputeService'
import { listOrderRefunds } from './refundService'

export async function getAdminDashboardSummary(serviceClient: SupabaseClient) {
  const [
    revenueResult,
    ordersResult,
    payoutsResult,
    disputesResult,
    refundsResult,
    chargebacksResult,
    escrowResult,
  ] = await Promise.all([
    serviceClient.from('platform_revenue_summary').select('*').maybeSingle(),
    serviceClient
      .from('orders')
      .select('id, status, payment_status, currency, total_amount, escrow_status, payout_status, created_at')
      .eq('payment_status', 'completed'),
    serviceClient
      .from('seller_payouts')
      .select('id, status, amount, currency, gateway, created_at'),
    serviceClient
      .from('disputes')
      .select('id, status, created_at, sla_seller_deadline'),
    serviceClient
      .from('refund_transactions')
      .select('id, amount, currency, status, created_at'),
    serviceClient
      .from('chargeback_events')
      .select('id, status, amount, currency, created_at'),
    serviceClient
      .from('orders')
      .select('id, seller_net_amount, currency, escrow_status')
      .in('escrow_status', ['held', 'scheduled', 'frozen']),
  ])

  const orders = ordersResult.data ?? []
  const payouts = payoutsResult.data ?? []
  const disputes = disputesResult.data ?? []
  const refunds = refundsResult.data ?? []
  const chargebacks = chargebacksResult.data ?? []
  const escrowOrders = escrowResult.data ?? []

  const gmvByCurrency: Record<string, number> = {}
  const ordersByStatus: Record<string, number> = {}

  for (const order of orders) {
    const currency = order.currency || 'USD'
    gmvByCurrency[currency] = (gmvByCurrency[currency] ?? 0) + Number(order.total_amount ?? 0)
    const s = order.status || 'unknown'
    ordersByStatus[s] = (ordersByStatus[s] ?? 0) + 1
  }

  const payoutsByStatus: Record<string, number> = {}
  const payoutsByGateway: Record<string, number> = {}
  for (const p of payouts) {
    payoutsByStatus[p.status] = (payoutsByStatus[p.status] ?? 0) + 1
    const gw = p.gateway || 'unknown'
    payoutsByGateway[gw] = (payoutsByGateway[gw] ?? 0) + 1
  }

  const escrowByCurrency: Record<string, number> = {}
  for (const o of escrowOrders) {
    const currency = o.currency || 'USD'
    escrowByCurrency[currency] =
      (escrowByCurrency[currency] ?? 0) + Number(o.seller_net_amount ?? 0)
  }

  const openDisputes = disputes.filter((d) =>
    ['open', 'awaiting_seller', 'under_review'].includes(d.status)
  )
  const slaBreaches = openDisputes.filter(
    (d) => d.sla_seller_deadline && new Date(d.sla_seller_deadline) < new Date()
  )

  const refundsByCurrency: Record<string, number> = {}
  for (const r of refunds.filter((x) => x.status === 'completed')) {
    const currency = r.currency || 'USD'
    refundsByCurrency[currency] = (refundsByCurrency[currency] ?? 0) + Number(r.amount ?? 0)
  }

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)

  return {
    revenue: revenueResult.data ?? null,
    gmv_by_currency: gmvByCurrency,
    orders_by_status: ordersByStatus,
    total_orders: orders.length,
    payouts_by_status: payoutsByStatus,
    payouts_by_gateway: payoutsByGateway,
    total_payouts: payouts.length,
    open_disputes: openDisputes.length,
    dispute_sla_breaches: slaBreaches.length,
    total_refunds: refunds.filter((r) => r.status === 'completed').length,
    refunds_by_currency: refundsByCurrency,
    open_chargebacks: chargebacks.filter((c) => c.status === 'open').length,
    escrow_by_currency: escrowByCurrency,
    recent_orders: recentOrders.map((o) => ({
      id: o.id,
      status: o.status,
      currency: o.currency,
      total_amount: o.total_amount,
      escrow_status: o.escrow_status,
      payout_status: o.payout_status,
      created_at: o.created_at,
    })),
  }
}

export async function listAdminOrders(
  serviceClient: SupabaseClient,
  filters: {
    status?: string
    escrow_status?: string
    page?: number
    limit?: number
  }
) {
  const page = filters.page ?? 0
  const limit = Math.min(filters.limit ?? 20, 100)
  const from = page * limit
  const to = from + limit - 1

  let query = serviceClient
    .from('orders')
    .select(
      'id, order_number, product_title, total_amount, currency, status, payment_status, escrow_status, payout_status, buyer_id, seller_id, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.escrow_status) query = query.eq('escrow_status', filters.escrow_status)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return { data: data ?? [], count: count ?? 0, page, limit }
}

export async function getAdminOrderDetail(serviceClient: SupabaseClient, orderId: string) {
  const { data: order, error } = await serviceClient
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') throw new Error('Order not found')
    throw new Error(error.message)
  }

  const [
    { data: sellerProfile },
    { data: buyerProfile },
    dispute,
    refunds,
    { data: payouts },
  ] = await Promise.all([
    serviceClient
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .eq('id', order.seller_id)
      .single(),
    serviceClient
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .eq('id', order.buyer_id)
      .single(),
    getOrderDispute(serviceClient, orderId),
    listOrderRefunds(serviceClient, orderId),
    serviceClient
      .from('seller_payouts')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
  ])

  return {
    ...order,
    seller: sellerProfile
      ? {
          id: sellerProfile.id,
          username: sellerProfile.username,
          full_name: sellerProfile.full_name,
          avatar_url: sellerProfile.avatar_url,
        }
      : undefined,
    buyer: buyerProfile
      ? {
          id: buyerProfile.id,
          username: buyerProfile.username,
          full_name: buyerProfile.full_name,
          avatar_url: buyerProfile.avatar_url,
        }
      : undefined,
    dispute,
    refunds,
    payouts: payouts ?? [],
  }
}

export async function listAdminPayouts(
  serviceClient: SupabaseClient,
  filters: { status?: string; page?: number; limit?: number }
) {
  const page = filters.page ?? 0
  const limit = Math.min(filters.limit ?? 20, 100)
  const from = page * limit
  const to = from + limit - 1

  let query = serviceClient
    .from('seller_payouts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.status) query = query.eq('status', filters.status)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return { data: data ?? [], count: count ?? 0, page, limit }
}
