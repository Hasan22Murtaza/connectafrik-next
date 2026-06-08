import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const { orderId } = await params
    const serviceClient = createServiceClient()

    const { data: order, error } = await serviceClient
      .from('orders')
      .select(`
        id, buyer_id, seller_id, escrow_status, payout_status,
        release_scheduled_at, release_eligible_at, delivery_confirmed_at,
        paid_to_seller_at, seller_net_amount, currency, payment_gateway
      `)
      .eq('id', orderId)
      .single()

    if (error || !order) {
      return errorResponse('Order not found', 404)
    }

    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return errorResponse('You are not authorized to view this order', 403)
    }

    return jsonResponse({ data: order })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
