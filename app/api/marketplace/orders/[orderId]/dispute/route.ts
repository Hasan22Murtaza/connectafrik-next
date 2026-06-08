import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getOrderDispute } from '@/lib/marketplace/disputeService'

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
      return errorResponse('Unauthorized', 403)
    }

    const dispute = await getOrderDispute(serviceClient, orderId)

    return jsonResponse({ data: dispute })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
