import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { listOrderRefunds } from '@/lib/marketplace/refundService'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const { orderId } = await params
    const serviceClient = createServiceClient()

    const { data: order } = await serviceClient
      .from('orders')
      .select('buyer_id, seller_id')
      .eq('id', orderId)
      .single()

    if (!order) {
      return errorResponse('Order not found', 404)
    }

    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return errorResponse('You are not authorized to view refunds for this order', 403)
    }

    const refunds = await listOrderRefunds(serviceClient, orderId)
    return jsonResponse({ data: refunds })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
