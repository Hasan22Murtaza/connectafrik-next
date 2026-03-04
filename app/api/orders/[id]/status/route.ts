import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      .select('seller_id, status')
      .eq('id', id)
      .single()

    if (!order) {
      return errorResponse('Order not found', 404)
    }

    if (order.seller_id !== user.id) {
      return errorResponse('Only the seller can update order status', 403)
    }

    const statusFlow: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['completed'],
      completed: [],
      cancelled: [],
      refunded: [],
    }

    const allowedNext = statusFlow[order.status] || []
    if (!allowedNext.includes(newStatus)) {
      return errorResponse(`Cannot transition from "${order.status}" to "${newStatus}"`, 400)
    }

    let deliveryStatus = 'pending'
    if (newStatus === 'processing') deliveryStatus = 'processing'
    else if (newStatus === 'shipped') deliveryStatus = 'shipped'
    else if (newStatus === 'completed') deliveryStatus = 'delivered'

    const { error } = await supabase
      .from('orders')
      .update({
        status: newStatus,
        delivery_status: deliveryStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error

    return jsonResponse({ success: true, status: newStatus, delivery_status: deliveryStatus })
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    console.error('PATCH /api/orders/[id]/status error:', err)
    return errorResponse(err.message || 'Failed to update order status', 500)
  }
}
