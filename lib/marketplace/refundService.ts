import { SupabaseClient } from '@supabase/supabase-js'
import { appendOrderLedgerEntry } from './orderLedger'
import { processGatewayRefund, RefundGateway } from './gatewayRefund'

export type RefundInitiatorRole = 'buyer' | 'seller' | 'admin' | 'system'

interface RefundableOrder {
  id: string
  buyer_id: string
  seller_id: string
  product_id: string | null
  quantity: number | null
  total_amount: number
  currency: string
  payment_status: string
  payment_method: string | null
  payment_gateway: string | null
  payment_reference: string | null
  status: string
  escrow_status: string | null
  payout_status: string | null
  refunded_amount: number | null
  refund_status: string | null
}

const PRE_SHIPMENT_STATUSES = new Set(['pending', 'confirmed', 'processing'])

export function isPreShipmentStatus(status: string): boolean {
  return PRE_SHIPMENT_STATUSES.has(status)
}

export function getRefundableAmount(order: RefundableOrder): number {
  const total = Number(order.total_amount)
  const alreadyRefunded = Number(order.refunded_amount ?? 0)
  return Math.max(0, Math.round((total - alreadyRefunded) * 100) / 100)
}

function resolveGateway(_order: RefundableOrder): RefundGateway {
  return 'stripe'
}

async function cancelActivePayouts(serviceClient: SupabaseClient, orderId: string): Promise<void> {
  await serviceClient
    .from('seller_payouts')
    .update({
      status: 'cancelled',
      notes: 'Cancelled due to order refund',
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .in('status', ['pending', 'approved', 'processing'])
}

async function restoreProductStock(
  serviceClient: SupabaseClient,
  order: RefundableOrder
): Promise<void> {
  if (!order.product_id || !order.quantity) return

  const { data: product } = await serviceClient
    .from('products')
    .select('stock_quantity')
    .eq('id', order.product_id)
    .single()

  if (product?.stock_quantity != null) {
    await serviceClient
      .from('products')
      .update({ stock_quantity: product.stock_quantity + order.quantity })
      .eq('id', order.product_id)
  }
}

export async function issueOrderRefund(
  serviceClient: SupabaseClient,
  orderId: string,
  options: {
    amount?: number
    reason: string
    initiatedBy: string
    initiatorRole: RefundInitiatorRole
    markCancelled?: boolean
  }
) {
  const { data: order, error: orderError } = await serviceClient
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    throw new Error('Order not found')
  }

  const typedOrder = order as RefundableOrder

  if (typedOrder.payment_status !== 'completed') {
    throw new Error('Order payment is not eligible for refund')
  }

  if (typedOrder.status === 'refunded' || typedOrder.refund_status === 'full') {
    throw new Error('Order has already been fully refunded')
  }

  if (typedOrder.payout_status === 'completed') {
    throw new Error(
      'Seller has already been paid. Contact support for a post-payout refund.'
    )
  }

  const refundable = getRefundableAmount(typedOrder)
  if (refundable <= 0) {
    throw new Error('No refundable amount remaining')
  }

  const refundAmount =
    options.amount != null
      ? Math.min(Math.round(options.amount * 100) / 100, refundable)
      : refundable

  if (refundAmount <= 0) {
    throw new Error('Refund amount must be greater than zero')
  }

  if (!typedOrder.payment_reference) {
    throw new Error('Order is missing payment reference for refund')
  }

  const gateway = resolveGateway(typedOrder)

  const { data: paymentTx } = await serviceClient
    .from('payment_transactions')
    .select('id')
    .eq('order_id', orderId)
    .eq('status', 'success')
    .maybeSingle()

  const { data: refundRow, error: refundInsertError } = await serviceClient
    .from('refund_transactions')
    .insert({
      order_id: orderId,
      payment_transaction_id: paymentTx?.id ?? null,
      gateway,
      amount: refundAmount,
      currency: typedOrder.currency,
      reason: options.reason,
      status: 'processing',
      initiated_by: options.initiatedBy,
      initiator_role: options.initiatorRole,
    })
    .select('id')
    .single()

  if (refundInsertError || !refundRow) {
    throw new Error(refundInsertError?.message || 'Failed to create refund record')
  }

  const gatewayResult = await processGatewayRefund(
    gateway,
    typedOrder.payment_reference,
    refundAmount,
    typedOrder.currency
  )

  if (!gatewayResult.success) {
    await serviceClient
      .from('refund_transactions')
      .update({
        status: 'failed',
        failure_reason: gatewayResult.error,
        completed_at: new Date().toISOString(),
      })
      .eq('id', refundRow.id)

    throw new Error(gatewayResult.error || 'Gateway refund failed')
  }

  const newRefundedTotal =
    Math.round((Number(typedOrder.refunded_amount ?? 0) + refundAmount) * 100) / 100
  const isFullRefund = newRefundedTotal >= Number(typedOrder.total_amount)
  const now = new Date().toISOString()

  await serviceClient
    .from('refund_transactions')
    .update({
      status: 'completed',
      gateway_refund_id: gatewayResult.gateway_refund_id,
      completed_at: now,
    })
    .eq('id', refundRow.id)

  await cancelActivePayouts(serviceClient, orderId)

  const orderUpdate: Record<string, unknown> = {
    refunded_amount: newRefundedTotal,
    refund_status: isFullRefund ? 'full' : 'partial',
    escrow_status: 'refunded',
    payout_status: 'cancelled',
    updated_at: now,
  }

  if (isFullRefund) {
    orderUpdate.payment_status = 'refunded'
    orderUpdate.status = options.markCancelled ? 'cancelled' : 'refunded'
  }

  if (options.markCancelled) {
    orderUpdate.cancelled_at = now
    orderUpdate.cancelled_by = options.initiatedBy
    orderUpdate.cancellation_reason = options.reason
    orderUpdate.delivery_status = 'cancelled'
  }

  await serviceClient.from('orders').update(orderUpdate).eq('id', orderId)

  if (options.markCancelled || isFullRefund) {
    await restoreProductStock(serviceClient, typedOrder)
  }

  await appendOrderLedgerEntry(serviceClient, {
    order_id: orderId,
    entry_type: isFullRefund ? 'refund_issued' : 'refund_partial',
    amount: refundAmount,
    currency: typedOrder.currency,
    balance_after: Math.max(0, Number(typedOrder.total_amount) - newRefundedTotal),
    reference_type: 'refund_transactions',
    reference_id: refundRow.id,
    metadata: {
      reason: options.reason,
      gateway,
      gateway_refund_id: gatewayResult.gateway_refund_id,
      initiator_role: options.initiatorRole,
    },
    created_by: options.initiatedBy,
  })

  return {
    success: true,
    refund_id: refundRow.id,
    order_id: orderId,
    amount: refundAmount,
    currency: typedOrder.currency,
    refund_status: isFullRefund ? 'full' : 'partial',
    gateway_refund_id: gatewayResult.gateway_refund_id,
    message: isFullRefund
      ? 'Full refund processed successfully'
      : `Partial refund of ${refundAmount} ${typedOrder.currency} processed`,
  }
}

export async function cancelOrderWithRefund(
  serviceClient: SupabaseClient,
  orderId: string,
  userId: string,
  reason: string,
  role: RefundInitiatorRole
) {
  const { data: order, error } = await serviceClient
    .from('orders')
    .select('id, buyer_id, seller_id, status, payment_status, payout_status')
    .eq('id', orderId)
    .single()

  if (error || !order) {
    throw new Error('Order not found')
  }

  if (order.status === 'cancelled' || order.status === 'refunded') {
    throw new Error('Order is already cancelled or refunded')
  }

  if (order.status === 'shipped' || order.status === 'completed') {
    throw new Error('Cannot cancel an order that has already shipped')
  }

  if (role === 'buyer' && order.buyer_id !== userId) {
    throw new Error('Only the buyer can cancel this order')
  }

  if (role === 'seller' && order.seller_id !== userId) {
    throw new Error('Only the seller can cancel this order')
  }

  if (!isPreShipmentStatus(order.status)) {
    throw new Error('Order cannot be cancelled at this stage')
  }

  if (order.payment_status === 'completed') {
    return issueOrderRefund(serviceClient, orderId, {
      reason,
      initiatedBy: userId,
      initiatorRole: role,
      markCancelled: true,
    })
  }

  const now = new Date().toISOString()
  await serviceClient
    .from('orders')
    .update({
      status: 'cancelled',
      delivery_status: 'cancelled',
      escrow_status: 'refunded',
      payout_status: 'cancelled',
      cancelled_at: now,
      cancelled_by: userId,
      cancellation_reason: reason,
      updated_at: now,
    })
    .eq('id', orderId)

  await cancelActivePayouts(serviceClient, orderId)

  return {
    success: true,
    order_id: orderId,
    refunded: false,
    message: 'Order cancelled',
  }
}

export async function listOrderRefunds(serviceClient: SupabaseClient, orderId: string) {
  const { data, error } = await serviceClient
    .from('refund_transactions')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}
