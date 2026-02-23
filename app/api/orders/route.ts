import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'purchases'

    const column = type === 'sales' ? 'seller_id' : 'buyer_id'

    const { data, error } = await supabase
      .from('order_with_parties')
      .select('*')
      .eq(column, user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    const orders = (data || []).map((order: any) => ({
      ...order,
      seller: order.seller_full_name
        ? {
            username: order.seller_username,
            full_name: order.seller_full_name,
            avatar_url: order.seller_avatar_url,
          }
        : undefined,
      buyer: order.buyer_full_name
        ? {
            username: order.buyer_username,
            full_name: order.buyer_full_name,
            avatar_url: order.buyer_avatar_url,
          }
        : undefined,
    }))

    return jsonResponse({ data: orders })
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    console.error('GET /api/orders error:', err)
    return errorResponse(err.message || 'Failed to fetch orders', 500)
  }
}
