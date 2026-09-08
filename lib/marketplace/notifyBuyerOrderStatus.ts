import { createServiceClient } from '@/lib/supabase-server'
import { sendOrderStatusChangeEmail, sendOrderReviewRequestEmail } from '@/shared/services/emailService'

export type OrderForStatusEmail = {
  buyer_id: string
  buyer_email?: string | null
  order_number?: string | null
  product_title?: string | null
  product_id?: string | null
  quantity?: number | null
  total_amount?: number | null
  currency?: string | null
}

export const ORDER_STATUS_EMAIL_SELECT =
  'seller_id, buyer_id, buyer_email, status, payment_status, payment_method, order_number, product_title, product_id, quantity, total_amount, currency'

/** Fire-and-forget buyer email when an order status changes. Never throws. */
export async function notifyBuyerOfOrderStatusChange(
  order: OrderForStatusEmail,
  newStatus: string,
  orderId: string
): Promise<void> {
  try {
    const serviceClient = createServiceClient()
    let buyerEmail = typeof order.buyer_email === 'string' ? order.buyer_email : ''

    if (!buyerEmail.includes('@')) {
      const { data: authData, error: authErr } = await serviceClient.auth.admin.getUserById(
        order.buyer_id
      )
      buyerEmail = authData?.user?.email || ''
      if (authErr || !buyerEmail.includes('@')) return
    }

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('full_name, username')
      .eq('id', order.buyer_id)
      .maybeSingle()

    const buyerName =
      profile?.full_name || profile?.username || buyerEmail.split('@')[0] || 'there'

    await sendOrderStatusChangeEmail(buyerEmail, {
      orderNumber: order.order_number || orderId,
      productTitle: order.product_title || 'Your order',
      quantity: order.quantity || 1,
      totalAmount: Number(order.total_amount || 0),
      currency: order.currency || 'USD',
      buyerName,
      newStatus,
      orderId,
    })

    const statusKey = (newStatus || '').toLowerCase()
    if ((statusKey === 'delivered' || statusKey === 'completed') && order.product_id) {
      await sendOrderReviewRequestEmail(buyerEmail, {
        buyerName,
        productTitle: order.product_title || 'your order',
        productId: order.product_id,
        orderNumber: order.order_number || orderId,
        orderId,
      })
    }
  } catch (error) {
    console.error('Order status change email failed:', error)
  }
}
