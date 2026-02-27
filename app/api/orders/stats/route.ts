import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const sumTotalAmount = (rows: Array<{ total_amount: number | null }> | null) =>
  (rows || []).reduce((sum, row) => sum + (Number(row.total_amount) || 0), 0)

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const [
      purchasesTotalResult,
      purchasesPendingResult,
      purchasesCompletedResult,
      salesTotalResult,
      salesPendingResult,
      salesCompletedResult,
      purchasesSpentResult,
      salesEarnedResult,
    ] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id).eq('status', 'pending'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id).eq('status', 'completed'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('seller_id', user.id),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('seller_id', user.id).eq('status', 'pending'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('seller_id', user.id).eq('status', 'completed'),
      supabase.from('orders').select('total_amount').eq('buyer_id', user.id).eq('payment_status', 'completed'),
      supabase.from('orders').select('total_amount').eq('seller_id', user.id).eq('payment_status', 'completed'),
    ])

    const firstError =
      purchasesTotalResult.error ||
      purchasesPendingResult.error ||
      purchasesCompletedResult.error ||
      salesTotalResult.error ||
      salesPendingResult.error ||
      salesCompletedResult.error ||
      purchasesSpentResult.error ||
      salesEarnedResult.error

    if (firstError) throw firstError

    return jsonResponse({
      purchases: {
        total: purchasesTotalResult.count || 0,
        pending: purchasesPendingResult.count || 0,
        completed: purchasesCompletedResult.count || 0,
        totalSpent: sumTotalAmount(purchasesSpentResult.data),
      },
      sales: {
        total: salesTotalResult.count || 0,
        pending: salesPendingResult.count || 0,
        completed: salesCompletedResult.count || 0,
        totalEarned: sumTotalAmount(salesEarnedResult.data),
      },
    })
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    console.error('GET /api/orders/stats error:', err)
    return errorResponse(err.message || 'Failed to fetch order stats', 500)
  }
}
