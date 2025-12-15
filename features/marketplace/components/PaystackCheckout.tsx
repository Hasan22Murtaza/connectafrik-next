'use client'

import React, { useState, useMemo } from 'react'
import { PaystackButton } from 'react-paystack'
import { X, ShoppingCart, MapPin, Phone, Mail, Info } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Product } from '@/shared/types'
// Email functions moved to API routes
const sendOrderConfirmationEmail = async (buyerEmail: string, orderDetails: any) => {
  try {
    const response = await fetch('/api/email/order-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerEmail, orderDetails }),
    })
    return response.ok
  } catch (error) {
    console.error('Error sending order confirmation email:', error)
    return false
  }
}

const sendNewOrderNotificationEmail = async (sellerEmail: string, orderDetails: any) => {
  try {
    const response = await fetch('/api/email/order-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sellerEmail, orderDetails }),
    })
    return response.ok
  } catch (error) {
    console.error('Error sending order notification email:', error)
    return false
  }
}
import toast from 'react-hot-toast'

interface PaystackCheckoutProps {
  product: Product
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const PaystackCheckout: React.FC<PaystackCheckoutProps> = ({
  product,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user } = useAuth()
  const [quantity, setQuantity] = useState(1)
  const [shippingAddress, setShippingAddress] = useState({
    street: '',
    city: '',
    state: '',
    country: '',
    postal_code: ''
  })
  const [buyerPhone, setBuyerPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const totalAmount = product.price * quantity
  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY

  // Calculate commission breakdown with payment gateway fee split
  const commissionBreakdown = useMemo(() => {
    // Paystack fee varies by currency
    let percentageFee = 0
    let flatFee = 0

    switch (product.currency) {
      case 'NGN': // Nigeria
        percentageFee = 0.015 // 1.5%
        flatFee = 100 // ₦100
        break
      case 'GHS': // Ghana
        percentageFee = 0.0195 // 1.95%
        flatFee = 0.50 // GH₵0.50
        break
      case 'ZAR': // South Africa
        percentageFee = 0.029 // 2.9%
        flatFee = 0 // No flat fee
        break
      case 'KES': // Kenya
        percentageFee = 0.035 // 3.5%
        flatFee = 0 // No flat fee
        break
      default: // International (USD, etc.)
        percentageFee = 0.039 // 3.9%
        flatFee = 0 // No flat fee
    }

    // Calculate gateway fee
    const gateway_fee = Math.round((totalAmount * percentageFee + flatFee) * 100) / 100

    // Split fee: Platform 5%, Seller 95%
    const platform_fee_share = Math.round(gateway_fee * 0.05 * 100) / 100
    const seller_fee_share = Math.round(gateway_fee * 0.95 * 100) / 100

    // Commission after platform's fee share
    const commission_amount = Math.round((totalAmount * 0.05 - platform_fee_share) * 100) / 100

    // Seller payout after their fee share
    const seller_payout = Math.round((totalAmount * 0.95 - seller_fee_share) * 100) / 100

    return {
      total_amount: totalAmount,
      commission_rate: 0.05,
      commission_amount,
      seller_payout,
      gateway_fee,
      platform_fee_share,
      seller_fee_share
    }
  }, [totalAmount, product.currency])

  if (!isOpen || !user) return null

  // Paystack configuration
  const componentProps = {
    email: user?.user_metadata?.email || user?.id || 'customer@connectafrik.com',
    amount: Math.round(totalAmount * 100), // Paystack expects amount in kobo/cents
    currency: product.currency || 'USD',
    publicKey,
    text: 'Pay Now',
    metadata: {
      custom_fields: [
        {
          display_name: 'Product',
          variable_name: 'product_title',
          value: product.title
        },
        {
          display_name: 'Quantity',
          variable_name: 'quantity',
          value: quantity.toString()
        },
        {
          display_name: 'Buyer',
          variable_name: 'buyer_name',
          value: user?.user_metadata?.full_name || user?.email || 'Unknown'
        }
      ]
    },
    onSuccess: async (reference: any) => {
      await handlePaymentSuccess(reference)
    },
    onClose: () => {
      if (!isProcessing) {
        toast('Payment cancelled', { icon: 'ℹ️' })
      }
    }
  }

  const handlePaymentSuccess = async (reference: any) => {
    setIsProcessing(true)
    try {
      // Create order in database
      const orderData = {
        buyer_id: user!.id,
        buyer_email: user?.email || 'support@connectafrik.com',
        buyer_phone: buyerPhone || null,
        seller_id: product.seller_id,
        product_id: product.id,
        product_title: product.title,
        product_image: product.images?.[0] || null,
        quantity,
        unit_price: product.price,
        total_amount: totalAmount,
        currency: product.currency || 'USD',
        payment_status: 'completed',
        payment_method: 'paystack',
        payment_reference: reference.reference,
        paid_at: new Date().toISOString(),
        shipping_address: shippingAddress.street ? shippingAddress : null,
        notes: notes || null,
        status: 'confirmed'
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single()

      if (orderError) throw orderError

      // Create payment transaction record
      await supabase
        .from('payment_transactions')
        .insert({
          order_id: order.id,
          transaction_reference: reference.reference,
          amount: totalAmount,
          currency: product.currency || 'USD',
          status: 'success',
          paystack_response: reference,
          verified_at: new Date().toISOString()
        })

      // Update product stock if available
      if (product.stock_quantity !== null && product.stock_quantity !== undefined) {
        await supabase
          .from('products')
          .update({ stock_quantity: Math.max(0, product.stock_quantity - quantity) })
          .eq('id', product.id)
      }

      // Send confirmation emails (non-blocking)
      const buyerName = user?.user_metadata?.full_name || user?.email || 'Customer'
      const sellerName = product.seller?.full_name || product.seller?.username || 'Seller'
      const buyerEmail = user?.email || 'support@connectafrik.com'

      // Send buyer confirmation email
      sendOrderConfirmationEmail(buyerEmail || 'support@connectafrik.com', {
        orderNumber: order.order_number,
        productTitle: product.title,
        quantity,
        totalAmount,
        currency: product.currency || 'USD',
        buyerName,
      }).catch(err => console.error('Failed to send buyer confirmation:', err))

      // Send seller notification email
      if (product.seller_id) {
        const sellerEmail = 'support@connectafrik.com' // Default seller email
        sendNewOrderNotificationEmail(sellerEmail || 'support@connectafrik.com', {
          orderNumber: order.order_number,
          productTitle: product.title,
          quantity,
          totalAmount,
          currency: product.currency || 'USD',
          buyerName,
          sellerName,
        }).catch(err => console.error('Failed to send seller notification:', err))
      }

      toast.success('Payment successful! Order created.')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error creating order:', error)
      toast.error('Payment succeeded but order creation failed. Please contact support.')
    } finally {
      setIsProcessing(false)
    }
  }

  const isFormValid = () => {
    return (
      quantity > 0 &&
      quantity <= (product.stock_quantity || Infinity) &&
      buyerPhone.trim() !== ''
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">Checkout</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Product Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start space-x-4">
              {product.images?.[0] && (
                <img
                  src={product.images[0]}
                  alt={product.title}
                  className="w-20 h-20 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{product.title}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Sold by: {product.seller?.full_name || product.seller?.username || 'Unknown Seller'}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-lg font-bold text-primary-600">
                    {product.currency === 'USD' && '$'}
                    {product.currency === 'GHS' && '₵'}
                    {product.currency === 'NGN' && '₦'}
                    {product.currency === 'KES' && 'KSh '}
                    {product.currency === 'ZAR' && 'R'}
                    {product.price.toLocaleString()}
                  </span>
                  {product.stock_quantity !== null && product.stock_quantity !== undefined && (
                    <span className="text-sm text-gray-500">
                      {product.stock_quantity} in stock
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity *
            </label>
            <input
              type="number"
              min="1"
              max={product.stock_quantity || undefined}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={isProcessing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Contact Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Phone className="w-4 h-4 inline mr-1" />
              Phone Number *
            </label>
            <input
              type="tel"
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              placeholder="Enter your phone number"
              disabled={isProcessing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Seller will contact you on this number
            </p>
          </div>

          {/* Shipping Address (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Shipping Address (Optional)
            </label>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Street Address"
                value={shippingAddress.street}
                onChange={(e) => setShippingAddress({ ...shippingAddress, street: e.target.value })}
                disabled={isProcessing}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="City"
                  value={shippingAddress.city}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                  disabled={isProcessing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <input
                  type="text"
                  placeholder="State/Region"
                  value={shippingAddress.state}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                  disabled={isProcessing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Country"
                  value={shippingAddress.country}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
                  disabled={isProcessing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <input
                  type="text"
                  placeholder="Postal Code"
                  value={shippingAddress.postal_code}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, postal_code: e.target.value })}
                  disabled={isProcessing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Special Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Special Instructions (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests or delivery instructions..."
              rows={3}
              disabled={isProcessing}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Order Summary */}
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Order Summary</h3>

            <div className="space-y-2">
              {/* Subtotal */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Subtotal ({quantity} item{quantity > 1 ? 's' : ''})</span>
                <span className="font-medium">
                  {product.currency === 'USD' && '$'}
                  {product.currency === 'GHS' && '₵'}
                  {product.currency === 'NGN' && '₦'}
                  {product.currency === 'KES' && 'KSh '}
                  {product.currency === 'ZAR' && 'R'}
                  {totalAmount.toLocaleString()}
                </span>
              </div>

              {/* Fee Breakdown */}
              <div className="bg-white rounded-md p-3 border border-primary-200">
                <div className="flex items-start gap-2 mb-3">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-600">
                    Payment fees are split fairly: ConnectAfrik pays 5%, seller pays 95% of gateway charges.
                  </p>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-gray-500">
                    <span>Payment Gateway Fee (Paystack)</span>
                    <span className="font-medium">
                      {product.currency === 'USD' && '$'}
                      {product.currency === 'GHS' && '₵'}
                      {product.currency === 'NGN' && '₦'}
                      {product.currency === 'KES' && 'KSh '}
                      {product.currency === 'ZAR' && 'R'}
                      {commissionBreakdown.gateway_fee?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pl-4 text-gray-400 text-[11px]">
                    <span>• Platform share (5%)</span>
                    <span>
                      {product.currency === 'USD' && '$'}
                      {product.currency === 'GHS' && '₵'}
                      {product.currency === 'NGN' && '₦'}
                      {product.currency === 'KES' && 'KSh '}
                      {product.currency === 'ZAR' && 'R'}
                      {commissionBreakdown.platform_fee_share?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pl-4 text-gray-400 text-[11px]">
                    <span>• Seller share (95%)</span>
                    <span>
                      {product.currency === 'USD' && '$'}
                      {product.currency === 'GHS' && '₵'}
                      {product.currency === 'NGN' && '₦'}
                      {product.currency === 'KES' && 'KSh '}
                      {product.currency === 'ZAR' && 'R'}
                      {commissionBreakdown.seller_fee_share?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="border-t border-gray-200 my-2"></div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Platform Fee (5%)</span>
                    <span className="text-gray-700 font-medium">
                      {product.currency === 'USD' && '$'}
                      {product.currency === 'GHS' && '₵'}
                      {product.currency === 'NGN' && '₦'}
                      {product.currency === 'KES' && 'KSh '}
                      {product.currency === 'ZAR' && 'R'}
                      {commissionBreakdown.commission_amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Seller Receives</span>
                    <span className="text-green-700 font-medium">
                      {product.currency === 'USD' && '$'}
                      {product.currency === 'GHS' && '₵'}
                      {product.currency === 'NGN' && '₦'}
                      {product.currency === 'KES' && 'KSh '}
                      {product.currency === 'ZAR' && 'R'}
                      {commissionBreakdown.seller_payout.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-primary-300 pt-3 mt-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">You Pay</span>
                <span className="text-2xl font-bold text-primary-600">
                  {product.currency === 'USD' && '$'}
                  {product.currency === 'GHS' && '₵'}
                  {product.currency === 'NGN' && '₦'}
                  {product.currency === 'KES' && 'KSh '}
                  {product.currency === 'ZAR' && 'R'}
                  {totalAmount.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Payment released to seller upon delivery confirmation
              </p>
            </div>
          </div>

          {/* Payment Button */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <PaystackButton
              {...componentProps as any}
              className={`flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                !isFormValid() ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={isProcessing || !isFormValid()}
            />
          </div>

          {/* Security Note */}
          <p className="text-xs text-center text-gray-500">
            🔒 Secure payment powered by Paystack. Your payment information is encrypted and secure.
          </p>
        </div>
      </div>
    </div>
  )
}

export default PaystackCheckout
