import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

/**
 * GET /api/orders/new-count
 * Pending orders that need attention for the current user (as buyer or seller).
 */
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)

    if (error) return errorResponse(error.message, 400)

    return jsonResponse({ new_order_count: count ?? 0 })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to fetch new order count', 500)
  }
}
