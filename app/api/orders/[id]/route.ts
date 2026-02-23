import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    if (!order) {
      return errorResponse('Order not found', 404)
    }

    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return errorResponse('You are not authorized to view this order', 403)
    }

    const isBuyer = order.buyer_id === user.id
    const isSeller = order.seller_id === user.id

    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .eq('id', order.seller_id)
      .single()

    const { data: buyerProfile } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .eq('id', order.buyer_id)
      .single()

    const orderDetail = {
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
      isBuyer,
      isSeller,
    }

    return jsonResponse({ data: orderDetail })
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    console.error('GET /api/orders/[id] error:', err)
    return errorResponse(err.message || 'Failed to fetch order', 500)
  }
}
