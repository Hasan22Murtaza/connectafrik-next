"use client";

import { useAuth } from '@/contexts/AuthContext';
import CancelOrderModal from '@/features/marketplace/components/CancelOrderModal';
import ConfirmDeliveryModal from '@/features/marketplace/components/ConfirmDeliveryModal';
import OpenDisputeModal from '@/features/marketplace/components/OpenDisputeModal';
import { Dispute, getOrderDispute } from '@/features/marketplace/services/disputeService';
import { getOrderRefunds, RefundTransaction } from '@/features/marketplace/services/refundService';
import { apiClient } from '@/lib/api-client';
import { OrderDetailPageShimmer } from '@/shared/components/ui/ShimmerLoaders';
import {
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  CreditCard,
  FileText,
  Mail,
  Package,
  Phone,
  Shield,
  ShoppingBag,
  Truck,
  User,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface OrderDetail {
  id: string
  order_number: string
  product_id: string
  product_title: string
  product_image: string | null
  quantity: number
  unit_price: number
  total_amount: number
  currency: string
  payment_status: string
  payment_method: string | null
  payment_reference: string | null
  delivery_status: string
  status: string
  buyer_email: string | null
  buyer_phone: string | null
  shipping_address: {
    street?: string
    city?: string
    state?: string
    country?: string
    postal_code?: string
  } | null
  notes: string | null
  created_at: string
  updated_at: string
  paid_at: string | null
  payout_status: string | null
  paid_to_seller_at: string | null
  escrow_status: string | null
  release_eligible_at: string | null
  release_scheduled_at: string | null
  delivery_confirmed_at: string | null
  refunded_amount: number | null
  refund_status: string | null
  cancellation_reason: string | null
  cancelled_at: string | null
  seller?: {
    id: string
    full_name: string
    username: string
    avatar_url: string | null
  }
  buyer?: {
    id: string
    full_name: string
    username: string
    avatar_url: string | null
  }
}

const OrderDetailPage: React.FC = () => {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const orderId = params?.id as string

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [isBuyer, setIsBuyer] = useState(false)
  const [isSeller, setIsSeller] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [showConfirmDelivery, setShowConfirmDelivery] = useState(false)
  const [showCancelOrder, setShowCancelOrder] = useState(false)
  const [showOpenDispute, setShowOpenDispute] = useState(false)
  const [refunds, setRefunds] = useState<RefundTransaction[]>([])
  const [dispute, setDispute] = useState<Dispute | null>(null)

  useEffect(() => {
    if (user && orderId) {
      fetchOrderDetails()
    }
  }, [user, orderId])

  const fetchOrderDetails = async () => {
    if (!user || !orderId) return

    try {
      setLoading(true)

      const res = await apiClient.get<{ data: OrderDetail & { isBuyer: boolean; isSeller: boolean } }>(`/api/orders/${orderId}`)
      const orderData = res.data

      if (!orderData) {
        toast.error('Order not found')
        router.push('/my-orders')
        return
      }

      setIsBuyer(orderData.isBuyer)
      setIsSeller(orderData.isSeller)
      setOrder(orderData)

      try {
        const disputeData = await getOrderDispute(orderId)
        setDispute(disputeData)
      } catch {
        setDispute(null)
      }

      if (
        orderData.refund_status === 'partial' ||
        orderData.refund_status === 'full' ||
        orderData.status === 'refunded' ||
        orderData.status === 'cancelled'
      ) {
        try {
          const refundList = await getOrderRefunds(orderId)
          setRefunds(refundList)
        } catch {
          setRefunds([])
        }
      } else {
        setRefunds([])
      }
    } catch (error: any) {
      console.error('Error fetching order details:', error)
      if (error.status === 403) {
        toast.error('You are not authorized to view this order')
      } else {
        toast.error('Failed to load order details')
      }
      router.push('/my-orders')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      confirmed: 'bg-blue-100 text-blue-700 border-blue-300',
      processing: 'bg-purple-100 text-purple-700 border-purple-300',
      shipped: 'bg-indigo-100 text-indigo-700 border-indigo-300',
      completed: 'bg-green-100 text-green-700 border-green-300',
      cancelled: 'bg-red-100 text-red-700 border-red-300',
      refunded: 'bg-surface-secondary text-content border-border'
    }
    return colors[status] || 'bg-surface-secondary text-content border-border'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5" />
      case 'completed':
        return <CheckCircle className="w-5 h-5" />
      case 'cancelled':
      case 'refunded':
        return <XCircle className="w-5 h-5" />
      default:
        return <Package className="w-5 h-5" />
    }
  }

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = {
      USD: '$',
      GHS: '₵',
      NGN: '₦',
      KES: 'KSh',
      ZAR: 'R',
      XOF: 'CFA',
      XAF: 'FCFA'
    }
    return symbols[currency] || currency
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const formatPaymentMethod = (method: string | null) => {
    if (!method) return 'N/A'
    return method.charAt(0).toUpperCase() + method.slice(1)
  }

  const updateOrderStatus = async (newStatus: string) => {
    if (!order || !user || !isSeller) return

    if (newStatus === 'cancelled') {
      const confirmed = window.confirm(
        'Cancel this order? The buyer will receive a full refund if payment was completed.'
      )
      if (!confirmed) return
    }

    try {
      setIsUpdatingStatus(true)

      await apiClient.patch(`/api/orders/${order.id}/status`, {
        status: newStatus,
        cancellation_reason:
          newStatus === 'cancelled' ? 'Cancelled by seller' : undefined,
      })

      await fetchOrderDetails()
      toast.success(
        newStatus === 'cancelled'
          ? 'Order cancelled and refund initiated'
          : `Order status updated to ${newStatus}`
      )
    } catch (error: any) {
      console.error('Error updating order status:', error)
      toast.error(error?.message || 'Failed to update order status')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const getNextStatusOptions = (currentStatus: string) => {
    const statusFlow: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['completed'],
      completed: [],
      cancelled: [],
      refunded: []
    }
    return statusFlow[currentStatus] || []
  }


  const statusColorMap: Record<string, string> = {
  pending: "text-yellow-600",
  processing: "text-blue-600",
  shipped: "text-indigo-600",
  delivered: "text-green-600",
  cancelled: "text-red-600",
};

const deliveryStatus = order?.delivery_status
  ? order.delivery_status.toLowerCase()
  : null;

const statusColor = deliveryStatus
  ? statusColorMap[deliveryStatus] ?? "text-content-secondary"
  : "text-content-tertiary";


  if (loading) {
    return <OrderDetailPageShimmer />
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center">
        <div className="text-center">
          <p className="text-content-secondary mb-4">Order not found</p>
          <button
            onClick={() => router.push('/my-orders')}
            className="btn-primary"
          >
            Back to Orders
          </button>
        </div>
      </div>
    )
  }

  const otherParty = isBuyer ? order.seller : order.buyer

  const canConfirmDelivery =
    isBuyer &&
    order.payment_status === 'completed' &&
    order.payout_status !== 'completed' &&
    !order.paid_to_seller_at &&
    order.escrow_status !== 'scheduled' &&
    order.escrow_status !== 'released' &&
    order.escrow_status !== 'frozen' &&
    order.status !== 'cancelled' &&
    order.status !== 'refunded' &&
    !dispute &&
    (order.status === 'shipped' ||
      order.delivery_status === 'shipped' ||
      order.status === 'completed')

  const canOpenDispute =
    isBuyer &&
    order.payment_status === 'completed' &&
    order.payout_status !== 'completed' &&
    !dispute &&
    order.status !== 'cancelled' &&
    order.status !== 'refunded' &&
    ['confirmed', 'processing', 'shipped', 'completed'].includes(order.status)

  const activeDisputeStatuses = ['open', 'awaiting_seller', 'under_review']
  const hasActiveDispute = dispute && activeDisputeStatuses.includes(dispute.status)

  const canCancelOrder =
    (isBuyer || isSeller) &&
    order.payment_status === 'completed' &&
    order.status !== 'cancelled' &&
    order.status !== 'refunded' &&
    order.refund_status !== 'full' &&
    ['pending', 'confirmed', 'processing'].includes(order.status)

  return (
    <div className="min-h-screen bg-surface-canvas w-full min-w-0 overflow-x-hidden">
      {/* Header */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-full 2xl:max-w-screen-2xl mx-auto px-3 sm:px-4 py-4 w-full min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-content mb-1">Order Details</h1>
              <p className="text-content-secondary">Order #{order.order_number}</p>
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-medium border flex items-center space-x-2 ${getStatusColor(order.status)}`}>
              {getStatusIcon(order.status)}
              <span className="capitalize">{order.status}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-full 2xl:max-w-screen-2xl mx-auto px-3 sm:px-4 py-4 w-full min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-3">
            {/* Product Information */}
            <div className="bg-surface rounded-lg border border-border-subtle p-4">
              <h2 className="text-base font-semibold text-content mb-3 flex items-center gap-1.5">
                <ShoppingBag className="w-5 h-5 text-primary-600" />
                <span>Product Information</span>
              </h2>
              
              <div className="flex gap-3">
                {order.product_image ? (
                  <img
                    src={order.product_image}
                    alt={order.product_title}
                    className="w-20 h-20 object-cover rounded-lg border border-border"
                  />
                ) : (
                  <div className="w-20 h-20 bg-surface-secondary rounded-lg border border-border flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 text-content-tertiary" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-content mb-2">{order.product_title}</h3>
                  <div className="space-y-1 text-sm text-content-secondary">
                    <p>Quantity: <span className="font-medium text-content">{order.quantity}</span></p>
                    <p>Unit Price: <span className="font-medium text-content">{getCurrencySymbol(order.currency)}{order.unit_price.toLocaleString()}</span></p>
                    <p>Total: <span className="font-medium text-content text-lg">{getCurrencySymbol(order.currency)}{order.total_amount.toLocaleString()}</span></p>
                  </div>
                  <Link
                    href={`/marketplace/${order.product_id}`}
                    className="btn-primary hover:text-primary-700 text-sm font-medium mt-2 inline-block float-end"
                  >
                    View Product →
                  </Link>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="bg-surface rounded-lg border border-border-subtle p-4">
              <h2 className="text-base font-semibold text-content mb-3 flex items-center gap-1.5">
                <CreditCard className="w-5 h-5 text-primary-600" />
                <span>Payment Information</span>
              </h2>
              
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-border-subtle">
                  <span className="text-content-secondary">Payment Status</span>
                  <span className={`font-medium ${order.payment_status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {order.payment_status === 'completed' ? '✓ Paid' : 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border-subtle">
                  <span className="text-content-secondary">Payment Method</span>
                  <span className="font-medium text-content">{formatPaymentMethod(order.payment_method)}</span>
                </div>
                {order.payment_reference && (
                  <div className="flex justify-between py-2 border-b border-border-subtle">
                    <span className="text-content-secondary">Transaction Reference</span>
                    <span className="font-medium text-content font-mono text-sm">{order.payment_reference}</span>
                  </div>
                )}
                {order.paid_at && (
                  <div className="flex justify-between py-2">
                    <span className="text-content-secondary">Paid At</span>
                    <span className="font-medium text-content">{formatDate(order.paid_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Information */}
            <div className="bg-surface rounded-lg border border-border-subtle p-4">
              <h2 className="text-base font-semibold text-content mb-3 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-primary-600" />
                <span>Delivery Information</span>
              </h2>

              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 border-b border-border-subtle">
                  <span className="text-sm text-content-secondary">Delivery Status</span>
                  <span className={`text-sm font-medium capitalize ${statusColor}`}>
                    {order.delivery_status || "Not specified"}
                  </span>
                </div>

                {isSeller &&
                  order.status !== "completed" &&
                  order.status !== "cancelled" &&
                  order.status !== "refunded" && (
                    <div className="flex justify-between items-center py-1.5 border-b border-border-subtle">
                      <span className="text-sm text-content-secondary">Order Status</span>
                      <div className="relative">
                        <select
                          value={order.status}
                          onChange={(e) => {
                            if (e.target.value !== order.status) {
                              updateOrderStatus(e.target.value);
                            }
                          }}
                          disabled={isUpdatingStatus}
                          className="text-xs px-2 py-1 rounded border border-border bg-surface text-content hover:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none pr-6 min-w-[120px]"
                        >
                          <option value={order.status}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </option>
                          {getNextStatusOptions(order.status).map((status) => (
                            <option key={status} value={status}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-content-secondary pointer-events-none" />
                      </div>
                    </div>
                  )}

                {order.delivery_confirmed_at && (
                  <div className="flex justify-between py-1.5 border-b border-border-subtle">
                    <span className="text-sm text-content-secondary">Delivery Confirmed</span>
                    <span className="text-sm font-medium text-content">
                      {formatDate(order.delivery_confirmed_at)}
                    </span>
                  </div>
                )}

                {order.shipping_address ? (
                  <div className="py-1.5 border-b border-border-subtle">
                    <span className="text-sm text-content-secondary block mb-1.5">Shipping Address</span>
                    <div className="bg-surface-canvas rounded-lg p-2.5 text-sm text-content space-y-0.5">
                      {order.shipping_address.street && (
                        <p>{order.shipping_address.street}</p>
                      )}
                      <p>
                        {[
                          order.shipping_address.city,
                          order.shipping_address.state,
                          order.shipping_address.postal_code,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      {order.shipping_address.country && (
                        <p>{order.shipping_address.country}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between py-1.5 border-b border-border-subtle">
                    <span className="text-sm text-content-secondary">Shipping Address</span>
                    <span className="text-sm text-content-secondary">Not provided</span>
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  {canConfirmDelivery && (
                    <div className="rounded-lg bg-green-50 border border-green-100 p-2.5">
                      <p className="text-xs text-content-secondary mb-2">
                        Received your order? Confirm delivery to release payment to the seller.
                      </p>
                      <button
                        onClick={() => setShowConfirmDelivery(true)}
                        className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Confirm Delivery
                      </button>
                    </div>
                  )}

                  {isBuyer && order.payout_status === "completed" && (
                    <div className="rounded-lg bg-green-50 border border-green-100 p-2.5">
                      <p className="text-xs text-green-700 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        Delivery confirmed — seller payment has been released.
                      </p>
                    </div>
                  )}

                  {isBuyer &&
                    order.escrow_status === "scheduled" &&
                    order.release_eligible_at && (
                      <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5">
                        <p className="text-xs text-blue-700 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          Payout scheduled for {formatDate(order.release_eligible_at)}
                        </p>
                      </div>
                    )}

                  {canCancelOrder && isBuyer && (
                    <div className="rounded-lg bg-red-50 border border-red-100 p-2.5">
                      <p className="text-xs text-content-secondary mb-2">
                        Order not shipped yet? You can cancel for a full refund.
                      </p>
                      <button
                        onClick={() => setShowCancelOrder(true)}
                        className="w-full sm:w-auto px-4 py-2 bg-surface text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        Cancel Order
                      </button>
                    </div>
                  )}

                  {canOpenDispute && (
                    <div className="rounded-lg bg-orange-50 border border-orange-100 p-2.5">
                      <p className="text-xs text-content-secondary mb-2">
                        Having an issue with this order? Open a dispute to freeze seller payout.
                      </p>
                      <button
                        onClick={() => setShowOpenDispute(true)}
                        className="w-full sm:w-auto px-4 py-2 bg-surface text-orange-700 border border-orange-200 rounded-lg text-sm font-medium hover:bg-orange-100 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Shield className="w-4 h-4" />
                        Open Dispute
                      </button>
                    </div>
                  )}

                  {hasActiveDispute && dispute && (
                    <div className="rounded-lg bg-orange-50 border border-orange-100 p-2.5">
                      <p className="text-xs text-orange-700 flex items-center gap-1.5 mb-1.5">
                        <Shield className="w-3.5 h-3.5 shrink-0" />
                        {isSeller
                          ? "A buyer opened a dispute on this order. Respond before the deadline."
                          : "Dispute open — seller payout is frozen"}
                      </p>
                      <Link
                        href={`/marketplace/disputes/${dispute.id}`}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        {isSeller ? "Respond to dispute →" : "View dispute →"}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Refund Information */}
            {(order.refund_status === 'partial' ||
              order.refund_status === 'full' ||
              order.status === 'refunded' ||
              order.status === 'cancelled') && (
              <div className="bg-surface rounded-lg border border-border-subtle p-4">
                <h2 className="text-base font-semibold text-content mb-3 flex items-center gap-1.5">
                  <CreditCard className="w-5 h-5 text-primary-600" />
                  <span>Refund Information</span>
                </h2>
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b border-border-subtle">
                    <span className="text-content-secondary">Refund status</span>
                    <span className="font-medium capitalize text-content">
                      {order.refund_status || order.status}
                    </span>
                  </div>
                  {(order.refunded_amount ?? 0) > 0 && (
                    <div className="flex justify-between py-2 border-b border-border-subtle">
                      <span className="text-content-secondary">Refunded amount</span>
                      <span className="font-medium text-content">
                        {getCurrencySymbol(order.currency)}
                        {Number(order.refunded_amount).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {order.cancellation_reason && (
                    <div className="py-2">
                      <span className="text-content-secondary text-sm">Reason</span>
                      <p className="text-sm text-content mt-1">{order.cancellation_reason}</p>
                    </div>
                  )}
                  {refunds.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <p className="text-sm font-medium text-content">Refund history</p>
                      {refunds.map((refund) => (
                        <div
                          key={refund.id}
                          className="text-sm bg-surface-canvas rounded-lg p-3 flex justify-between gap-2"
                        >
                          <div>
                            <p className="font-medium text-content">
                              {getCurrencySymbol(refund.currency)}
                              {Number(refund.amount).toLocaleString()}
                            </p>
                            <p className="text-xs text-content-secondary capitalize">{refund.status}</p>
                          </div>
                          <p className="text-xs text-content-secondary">{formatDate(refund.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {order.notes && (
              <div className="bg-surface rounded-lg border border-border-subtle p-4">
                <h2 className="text-base font-semibold text-content mb-3 flex items-center gap-1.5">
                  <FileText className="w-5 h-5 text-primary-600" />
                  <span>Special Instructions</span>
                </h2>
                <p className="text-content whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            {/* Order Summary */}
            <div className="bg-surface rounded-lg border border-border-subtle p-4">
              <h2 className="text-base font-semibold text-content mb-3">Order Summary</h2>
              
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-border-subtle">
                  <span className="text-content-secondary">Subtotal</span>
                  <span className="font-medium text-content">
                    {getCurrencySymbol(order.currency)}{(order.unit_price * order.quantity).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border-subtle">
                  <span className="text-content-secondary">Quantity</span>
                  <span className="font-medium text-content">{order.quantity}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-lg font-semibold text-content">Total</span>
                  <span className="text-lg font-bold text-primary-600">
                    {getCurrencySymbol(order.currency)}{order.total_amount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Order Timeline */}
            <div className="bg-surface rounded-lg border border-border-subtle p-4">
              <h2 className="text-base font-semibold text-content mb-3 flex items-center gap-1.5">
                <Calendar className="w-5 h-5 text-primary-600" />
                <span>Timeline</span>
              </h2>
              
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-content-secondary">Order Placed</p>
                  <p className="text-sm font-medium text-content">{formatDate(order.created_at)}</p>
                </div>
                {order.paid_at && (
                  <div>
                    <p className="text-sm text-content-secondary">Payment Received</p>
                    <p className="text-sm font-medium text-content">{formatDate(order.paid_at)}</p>
                  </div>
                )}
                {order.updated_at !== order.created_at && (
                  <div>
                    <p className="text-sm text-content-secondary">Last Updated</p>
                    <p className="text-sm font-medium text-content">{formatDate(order.updated_at)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-surface rounded-lg border border-border-subtle p-4">
              <h2 className="text-base font-semibold text-content mb-3 flex items-center gap-1.5">
                <User className="w-5 h-5 text-primary-600" />
                <span>{isBuyer ? 'Seller' : 'Buyer'} Information</span>
              </h2>
              
              {otherParty ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    {otherParty.avatar_url ? (
                      <img
                        src={otherParty.avatar_url}
                        alt={otherParty.full_name}
                        className="w-12 h-12 rounded-full"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-lg font-medium text-primary-600">
                          {otherParty.full_name?.charAt(0) || '?'}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-content">{otherParty.full_name || otherParty.username}</p>
                      <Link
                        href={`/user/${otherParty.username}`}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        @{otherParty.username}
                      </Link>
                    </div>
                  </div>
                  {isBuyer && order.buyer_email && (
                    <div className="flex items-center space-x-2 text-sm text-content-secondary">
                      <Mail className="w-4 h-4" />
                      <span>{order.buyer_email}</span>
                    </div>
                  )}
                  {order.buyer_phone && (
                    <div className="flex items-center space-x-2 text-sm text-content-secondary">
                      <Phone className="w-4 h-4" />
                      <span>{order.buyer_phone}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-content-secondary text-sm">Information not available</p>
              )}
            </div>

            {/* Seller Status Update Section */}
            {isSeller && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'refunded' && (
              <div className="bg-surface rounded-lg border border-border-subtle p-4">
                <h2 className="text-base font-semibold text-content mb-3 flex items-center gap-1.5">
                  <Package className="w-5 h-5 text-primary-600" />
                  <span>Update Order Status</span>
                </h2>
                
                <div className="space-y-2">
                  <p className="text-sm text-content-secondary mb-4">
                    Current status: <span className="font-medium capitalize">{order.status}</span>
                  </p>
                  
                  <div className="flex flex-wrap gap-2">
                    {getNextStatusOptions(order.status).map((status) => (
                      <button
                        key={status}
                        onClick={() => updateOrderStatus(status)}
                        disabled={isUpdatingStatus}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          status === 'cancelled'
                            ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                            : 'bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isUpdatingStatus ? 'Updating...' : `Mark as ${status.charAt(0).toUpperCase() + status.slice(1)}`}
                      </button>
                    ))}
                  </div>
                  
                  <p className="text-xs text-content-secondary mt-3">
                    {order.status === 'pending' && 'Confirm the order to proceed with processing.'}
                    {order.status === 'confirmed' && 'Start processing the order or cancel if needed.'}
                    {order.status === 'processing' && 'Mark as shipped when the item is dispatched.'}
                    {order.status === 'shipped' && 'Mark as completed when the buyer receives the item.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {canConfirmDelivery && (
        <ConfirmDeliveryModal
          orderId={order.id}
          orderNumber={order.order_number}
          productTitle={order.product_title}
          sellerName={order.seller?.full_name || order.seller?.username || 'Seller'}
          isOpen={showConfirmDelivery}
          onClose={() => setShowConfirmDelivery(false)}
          onSuccess={fetchOrderDetails}
        />
      )}

      {canCancelOrder && isBuyer && (
        <CancelOrderModal
          orderId={order.id}
          orderNumber={order.order_number}
          productTitle={order.product_title}
          totalAmount={order.total_amount}
          currency={order.currency}
          isOpen={showCancelOrder}
          onClose={() => setShowCancelOrder(false)}
          onSuccess={fetchOrderDetails}
        />
      )}

      {canOpenDispute && (
        <OpenDisputeModal
          orderId={order.id}
          orderNumber={order.order_number}
          productTitle={order.product_title}
          isOpen={showOpenDispute}
          onClose={() => setShowOpenDispute(false)}
          onSuccess={(disputeId) => {
            fetchOrderDetails()
            router.push(`/marketplace/disputes/${disputeId}`)
          }}
        />
      )}
    </div>
  )
}

export default OrderDetailPage

