"use client";

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  CreditCard,
  User,
  Calendar,
  FileText,
  Truck,
  ShoppingBag,
  ChevronDown,
  Mail,
  Phone
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { OrderDetailPageShimmer } from '@/shared/components/ui/ShimmerLoaders'

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

  useEffect(() => {
    if (user && orderId) {
      fetchOrderDetails()
    }
  }, [user, orderId])

  const fetchOrderDetails = async () => {
    if (!user || !orderId) return

    try {
      setLoading(true)

      // Fetch order details from the orders table
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (orderError) throw orderError

      if (!orderData) {
        toast.error('Order not found')
        router.push('/my-orders')
        return
      }

      // Check if user is authorized to view this order
      if (orderData.buyer_id !== user.id && orderData.seller_id !== user.id) {
        toast.error('You are not authorized to view this order')
        router.push('/my-orders')
        return
      }

      setIsBuyer(orderData.buyer_id === user.id)
      setIsSeller(orderData.seller_id === user.id)

      // Fetch seller profile
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .eq('id', orderData.seller_id)
        .single()

      // Fetch buyer profile
      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .eq('id', orderData.buyer_id)
        .single()

      const orderDetail: OrderDetail = {
        ...orderData,
        seller: sellerProfile ? {
          id: sellerProfile.id,
          username: sellerProfile.username,
          full_name: sellerProfile.full_name,
          avatar_url: sellerProfile.avatar_url
        } : undefined,
        buyer: buyerProfile ? {
          id: buyerProfile.id,
          username: buyerProfile.username,
          full_name: buyerProfile.full_name,
          avatar_url: buyerProfile.avatar_url
        } : undefined
      }

      setOrder(orderDetail)
    } catch (error: any) {
      console.error('Error fetching order details:', error)
      toast.error('Failed to load order details')
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
      refunded: 'bg-gray-100 text-gray-700 border-gray-300'
    }
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-300'
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

    try {
      setIsUpdatingStatus(true)

      // Determine the next delivery status based on order status
      let deliveryStatus = order.delivery_status
      if (newStatus === 'processing') {
        deliveryStatus = 'processing'
      } else if (newStatus === 'shipped') {
        deliveryStatus = 'shipped'
      } else if (newStatus === 'completed') {
        deliveryStatus = 'delivered'
      }

      const { error } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          delivery_status: deliveryStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)

      if (error) throw error

      // Refresh order data
      await fetchOrderDetails()
      toast.success(`Order status updated to ${newStatus}`)
    } catch (error: any) {
      console.error('Error updating order status:', error)
      toast.error('Failed to update order status')
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
  ? statusColorMap[deliveryStatus] ?? "text-gray-500"
  : "text-gray-400";


  if (loading) {
    return <OrderDetailPageShimmer />
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Order not found</p>
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

  return (
    <div className="min-h-screen bg-gray-50 w-full min-w-0 overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-full 2xl:max-w-screen-2xl mx-auto px-3 sm:px-4 py-6 w-full min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Details</h1>
              <p className="text-gray-600">Order #{order.order_number}</p>
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-medium border flex items-center space-x-2 ${getStatusColor(order.status)}`}>
              {getStatusIcon(order.status)}
              <span className="capitalize">{order.status}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-full 2xl:max-w-screen-2xl mx-auto px-3 sm:px-4 py-6 w-full min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            {/* Product Information */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <ShoppingBag className="w-5 h-5 text-primary-600" />
                <span>Product Information</span>
              </h2>
              
              <div className="flex space-x-4">
                {order.product_image ? (
                  <img
                    src={order.product_image}
                    alt={order.product_title}
                    className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                    <ShoppingBag className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">{order.product_title}</h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Quantity: <span className="font-medium text-gray-900">{order.quantity}</span></p>
                    <p>Unit Price: <span className="font-medium text-gray-900">{getCurrencySymbol(order.currency)}{order.unit_price.toLocaleString()}</span></p>
                    <p>Total: <span className="font-medium text-gray-900 text-lg">{getCurrencySymbol(order.currency)}{order.total_amount.toLocaleString()}</span></p>
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
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-primary-600" />
                <span>Payment Information</span>
              </h2>
              
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Payment Status</span>
                  <span className={`font-medium ${order.payment_status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {order.payment_status === 'completed' ? '✓ Paid' : 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Payment Method</span>
                  <span className="font-medium text-gray-900">{formatPaymentMethod(order.payment_method)}</span>
                </div>
                {order.payment_reference && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Transaction Reference</span>
                    <span className="font-medium text-gray-900 font-mono text-sm">{order.payment_reference}</span>
                  </div>
                )}
                {order.paid_at && (
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Paid At</span>
                    <span className="font-medium text-gray-900">{formatDate(order.paid_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Information */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <Truck className="w-5 h-5 text-primary-600" />
                <span>Delivery Information</span>
              </h2>
              
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Delivery Status</span>
                  <span className={`font-medium capitalize ${statusColor}`}>
                    {order.delivery_status || "Not specified"}
                  </span>
                </div>
                {isSeller && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'refunded' && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Order Status</span>
                    <div className="relative group">
                      <select
                        value={order.status}
                        onChange={(e) => {
                          if (e.target.value !== order.status) {
                            updateOrderStatus(e.target.value);
                          }
                        }}
                        disabled={isUpdatingStatus}
                        className="text-sm px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none pr-8 min-w-[140px]"
                      >
                        <option value={order.status}>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</option>
                        {getNextStatusOptions(order.status).map((status) => (
                          <option key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>
                  </div>
                )}
                {order.shipping_address ? (
                  <div className="pt-2">
                    <p className="text-gray-600 mb-2">Shipping Address</p>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                      {order.shipping_address.street && <p className="text-gray-900">{order.shipping_address.street}</p>}
                      <p className="text-gray-900">
                        {[
                          order.shipping_address.city,
                          order.shipping_address.state,
                          order.shipping_address.postal_code
                        ].filter(Boolean).join(', ')}
                      </p>
                      {order.shipping_address.country && <p className="text-gray-900">{order.shipping_address.country}</p>}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No shipping address provided</p>
                )}
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-primary-600" />
                  <span>Special Instructions</span>
                </h2>
                <p className="text-gray-700 whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">
                    {getCurrencySymbol(order.currency)}{(order.unit_price * order.quantity).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Quantity</span>
                  <span className="font-medium text-gray-900">{order.quantity}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-primary-600">
                    {getCurrencySymbol(order.currency)}{order.total_amount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Order Timeline */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-primary-600" />
                <span>Timeline</span>
              </h2>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Order Placed</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(order.created_at)}</p>
                </div>
                {order.paid_at && (
                  <div>
                    <p className="text-sm text-gray-600">Payment Received</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(order.paid_at)}</p>
                  </div>
                )}
                {order.updated_at !== order.created_at && (
                  <div>
                    <p className="text-sm text-gray-600">Last Updated</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(order.updated_at)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <User className="w-5 h-5 text-primary-600" />
                <span>{isBuyer ? 'Seller' : 'Buyer'} Information</span>
              </h2>
              
              {otherParty ? (
                <div className="space-y-3">
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
                      <p className="font-medium text-gray-900">{otherParty.full_name || otherParty.username}</p>
                      <Link
                        href={`/user/${otherParty.username}`}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        @{otherParty.username}
                      </Link>
                    </div>
                  </div>
                  {isBuyer && order.buyer_email && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span>{order.buyer_email}</span>
                    </div>
                  )}
                  {order.buyer_phone && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4" />
                      <span>{order.buyer_phone}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Information not available</p>
              )}
            </div>

            {/* Seller Status Update Section */}
            {isSeller && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'refunded' && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <Package className="w-5 h-5 text-primary-600" />
                  <span>Update Order Status</span>
                </h2>
                
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">
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
                  
                  <p className="text-xs text-gray-500 mt-3">
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
    </div>
  )
}

export default OrderDetailPage

