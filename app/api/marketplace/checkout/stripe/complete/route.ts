import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json()

    const {
      payment_reference,
      product_id,
      product_title,
      product_image,
      seller_id,
      quantity,
      unit_price,
      total_amount,
      currency,
      shipping_address,
      buyer_phone,
      notes,
    } = body

    if (!payment_reference || !product_id || !seller_id) {
      return errorResponse('payment_reference, product_id, and seller_id are required', 400)
    }

    const { data: existingOrder } = await serviceClient
      .from('orders')
      .select('id')
      .eq('payment_reference', payment_reference)
      .maybeSingle()

    if (existingOrder) {
      return jsonResponse({ data: existingOrder, message: 'Order already exists' })
    }

    const orderData = {
      buyer_id: user.id,
      buyer_email: user.email || null,
      buyer_phone: buyer_phone || null,
      seller_id,
      product_id,
      product_title: product_title || null,
      product_image: product_image || null,
      quantity: quantity || 1,
      unit_price: unit_price || null,
      total_amount: total_amount || 0,
      currency: currency || 'USD',
      payment_status: 'completed',
      payment_method: 'stripe',
      payment_reference,
      paid_at: new Date().toISOString(),
      shipping_address: shipping_address || null,
      notes: notes || null,
      status: 'confirmed',
    }

    const { data: order, error: orderError } = await serviceClient
      .from('orders')
      .insert(orderData)
      .select()
      .single()

    if (orderError) {
      return errorResponse(orderError.message, 400)
    }

    await serviceClient.from('payment_transactions').insert({
      order_id: order.id,
      transaction_reference: payment_reference,
      amount: total_amount,
      currency: currency || 'USD',
      status: 'success',
      verified_at: new Date().toISOString(),
    })

    if (product_id && quantity) {
      const { data: product } = await serviceClient
        .from('products')
        .select('stock_quantity')
        .eq('id', product_id)
        .single()

      if (product?.stock_quantity != null) {
        await serviceClient
          .from('products')
          .update({ stock_quantity: Math.max(0, product.stock_quantity - quantity) })
          .eq('id', product_id)
      }
    }

    return jsonResponse({ data: order })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
