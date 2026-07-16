import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { cancelOrderWithRefund } from '@/lib/marketplace/refundService'
import {
  getDeliveryStatusForOrderStatus,
  getOrderDisplayLabelText,
  ORDER_STATUS_TRANSITIONS,
  type OrderStatus,
} from '@/lib/marketplace/orderStatus'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()
    const newStatus = body.status

    if (!newStatus) {
      return errorResponse('Missing status field', 400)
    }

    const { data: order } = await supabase
      .from('orders')
      .select('seller_id, buyer_id, status, payment_status, payment_method')
      .eq('id', id)
      .single()

    if (!order) {
      return errorResponse('Order not found', 404)
    }

    if (order.seller_id !== user.id) {
      return errorResponse('Only the seller can update order status', 403)
    }

    const statusFlow = ORDER_STATUS_TRANSITIONS
    const allowedNext = statusFlow[order.status as OrderStatus] || []
    if (!allowedNext.includes(newStatus)) {
      return errorResponse(`Cannot transition from "${order.status}" to "${newStatus}"`, 400)
    }

    if (newStatus === 'cancelled') {
      const serviceClient = createServiceClient()
      const reason =
        (body.cancellation_reason as string)?.trim() || 'Cancelled by seller'

      const result = await cancelOrderWithRefund(
        serviceClient,
        id,
        user.id,
        reason,
        'seller'
      )

      return jsonResponse({
        success: true,
        status: 'cancelled',
        delivery_status: 'cancelled',
        refund: result,
      })
    }

    const deliveryStatus = getDeliveryStatusForOrderStatus(newStatus)

    const { error } = await supabase
      .from('orders')
      .update({
        status: newStatus,
        delivery_status: deliveryStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error

    return jsonResponse({
      success: true,
      status: newStatus,
      delivery_status: deliveryStatus,
      display_label: getOrderDisplayLabelText({
        status: newStatus,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
      }),
    })
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Missing Authorization header')) {
      return unauthorizedResponse()
    }
    const message = err instanceof Error ? err.message : 'Failed to update order status'
    console.error('PATCH /api/orders/[id]/status error:', err)
    return errorResponse(message, message === 'Failed to update order status' ? 500 : 400)
  }
}
