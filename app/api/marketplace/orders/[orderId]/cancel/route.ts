import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { cancelOrderWithRefund } from '@/lib/marketplace/refundService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const { orderId } = await params
    const serviceClient = createServiceClient()
    const body = await request.json().catch(() => ({}))

    const reason = (body.reason as string)?.trim() || 'Order cancelled by user'

    const { data: order } = await serviceClient
      .from('orders')
      .select('buyer_id, seller_id')
      .eq('id', orderId)
      .single()

    if (!order) {
      return errorResponse('Order not found', 404)
    }

    let role: 'buyer' | 'seller'
    if (order.buyer_id === user.id) {
      role = 'buyer'
    } else if (order.seller_id === user.id) {
      role = 'seller'
    } else {
      return errorResponse('You are not authorized to cancel this order', 403)
    }

    const result = await cancelOrderWithRefund(
      serviceClient,
      orderId,
      user.id,
      reason,
      role
    )

    return jsonResponse({ data: result })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, message === 'Internal server error' ? 500 : 400)
  }
}
