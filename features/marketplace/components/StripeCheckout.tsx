'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { X, ShoppingCart, MapPin, Phone, Info } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Product } from '@/shared/types'
import { getStripe, createStripePaymentIntent, calculateStripeFees } from '@/features/marketplace/services/stripeService'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
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

interface StripeCheckoutProps {
  product: Product
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

// Payment form component (must be inside Elements provider)
const CheckoutForm: React.FC<{
  product: Product
  quantity: number
  totalAmount: number
  shippingAddress: any
  buyerPhone: string
  notes: string
  clientSecret: string
  onSuccess: () => void
  onClose: () => void
}> = ({
  product,
  quantity,
  totalAmount,
  shippingAddress,
  buyerPhone,
  notes,
  clientSecret: _clientSecret,
  onSuccess,
  onClose
}) => {
  const { user } = useAuth()
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      return
    }

    setIsProcessing(true)

    try {
      // Confirm payment for real Stripe payments
      if (!stripe || !elements) {
        toast.error('Payment form is still initializing. Please wait a moment.')
        setIsProcessing(false)
        return
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: typeof window !== 'undefined' ? window.location.href : '/marketplace', // Won't actually redirect
        },
        redirect: 'if_required'
      })

      if (stripeError) {
        toast.error(stripeError.message || 'Payment failed')
        setIsProcessing(false)
        return
      }

      if (paymentIntent?.status === 'succeeded') {
        // Create order in database
        const buyerEmail = user?.user_metadata?.email || user?.id || 'customer@connectafrik.com'
        const orderData = {
          buyer_id: user.id,
          buyer_email: buyerEmail,
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
          payment_method: 'stripe',
          payment_reference: paymentIntent.id,
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
        // if (orderError) throw orderError

        // Create payment transaction record
        await supabase
          .from('payment_transactions')
          .insert({
            order_id: order.id,
            transaction_reference: paymentIntent.id,
            amount: totalAmount,
            currency: product.currency || 'USD',
            status: 'success',
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
        const buyerName = user?.user_metadata?.full_name || user?.id || 'Customer'
        const sellerName = product.seller?.full_name || product.seller?.id || 'Seller'
        const buyerEmailConfirm = (buyerEmail || 'support@connectafrik.com') as string

        sendOrderConfirmationEmail(buyerEmailConfirm, {
          orderNumber: order.order_number,
          productTitle: product.title,
          quantity,
          totalAmount,
          currency: product.currency || 'USD',
          buyerName,
        }).catch(err => console.error('Failed to send buyer confirmation:', err))

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
      } else {
        toast.error('Payment incomplete')
      }
    } catch (error: any) {
      console.error('Error processing payment:', error)
      toast.error('Payment succeeded but order creation failed. Please contact support.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />

      <div className="flex space-x-3">
        <button
          type="button"
          onClick={onClose}
          disabled={isProcessing}
          className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isProcessing || (!stripe || !elements)}
          className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Processing...' : 'Pay Now'}
        </button>
      </div>

      <p className="text-xs text-center text-gray-500">
        🔒 Secure payment powered by Stripe. Your payment information is encrypted and secure.
      </p>
    </form>
  )
}

const StripeCheckout: React.FC<StripeCheckoutProps> = ({
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
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isLoadingPayment, setIsLoadingPayment] = useState(false)

  const totalAmount = product.price * quantity
  const stripePromise = getStripe()

  // Calculate commission breakdown
  const commissionBreakdown = useMemo(() => {
    const fees = calculateStripeFees(totalAmount, product.currency || 'USD')

    // Commission after platform's fee share
    const commission_amount = Math.round((totalAmount * 0.05 - fees.platform_fee_share) * 100) / 100

    // Seller payout after their fee share
    const seller_payout = Math.round((totalAmount * 0.95 - fees.seller_fee_share) * 100) / 100

    return {
      total_amount: totalAmount,
      commission_rate: 0.05,
      commission_amount,
      seller_payout,
      ...fees
    }
  }, [totalAmount, product.currency])

  // Create payment intent when form is valid
  useEffect(() => {
    if (isOpen && user && buyerPhone.trim() && !clientSecret) {
      setIsLoadingPayment(true)
      createStripePaymentIntent(totalAmount, product.currency || 'USD', {
        product_id: product.id,
        product_title: product.title,
        quantity: quantity.toString(),
        buyer_id: user!.id,
        buyer_email: user?.email || 'support@connectafrik.com'
      }).then(result => {
        if (result) {
          setClientSecret(result.clientSecret)
        } else {
          toast.error('Failed to initialize payment')
        }
        setIsLoadingPayment(false)
      })
    }
  }, [isOpen, user, buyerPhone, totalAmount, product, quantity, clientSecret])

  if (!isOpen || !user) return null

  const isFormValid = () => {
    return (
      quantity > 0 &&
      quantity <= (product.stock_quantity || Infinity) &&
      buyerPhone.trim() !== ''
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2" onClick={onClose}>
      <div className=" rounded-xl max-w-2xl w-full  overflow-hidden " onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-primary-600 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="w-5 h-5 text-white" />
            <h2 className="text-xl font-semibold text-white">Checkout</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="sm:p-6 p-4 space-y-6 bg-white overflow-y-auto max-h-[70vh]">
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
                    {['USD'].includes(product.currency) && '$'}
                    {['EUR'].includes(product.currency as any) && '€'}
                    {['GBP'].includes(product.currency as any) && '£'}
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Contact Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Phone className="w-4 h-4 inline mr-1" />
              Phone Number *
            </label>
            <div onClick={(e) => e.stopPropagation()}>
              <PhoneInput
                international
                defaultCountry="US"
                value={buyerPhone}
                onChange={(value) => setBuyerPhone(value || '')}
                placeholder="Enter your phone number"
                className="w-full"
                numberInputProps={{
                  className: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                }}
              />
            </div>
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="City"
                  value={shippingAddress.city}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onClick={(e) => e.stopPropagation()}
                />
                <input
                  type="text"
                  placeholder="State/Region"
                  value={shippingAddress.state}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Country"
                  value={shippingAddress.country}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onClick={(e) => e.stopPropagation()}
                />
                <input
                  type="text"
                  placeholder="Postal Code"
                  value={shippingAddress.postal_code}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, postal_code: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onClick={(e) => e.stopPropagation()}
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              onClick={(e) => e.stopPropagation()}
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
                  {(product.currency as any) === 'EUR' && '€'}
                  {(product.currency as any) === 'GBP' && '£'}
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
                    <span>Payment Gateway Fee (Stripe)</span>
                    <span className="font-medium">
                      {product.currency === 'USD' && '$'}
                      {(product.currency as any) === 'EUR' && '€'}
                      {(product.currency as any) === 'GBP' && '£'}
                      {commissionBreakdown.gateway_fee?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pl-4 text-gray-400 text-[11px]">
                    <span>• Platform share (5%)</span>
                    <span>
                      {product.currency === 'USD' && '$'}
                      {(product.currency as any) === 'EUR' && '€'}
                      {(product.currency as any) === 'GBP' && '£'}
                      {commissionBreakdown.platform_fee_share?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pl-4 text-gray-400 text-[11px]">
                    <span>• Seller share (95%)</span>
                    <span>
                      {product.currency === 'USD' && '$'}
                      {(product.currency as any) === 'EUR' && '€'}
                      {(product.currency as any) === 'GBP' && '£'}
                      {commissionBreakdown.seller_fee_share?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="border-t border-gray-200 my-2"></div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Platform Fee (5%)</span>
                    <span className="text-gray-700 font-medium">
                      {product.currency === 'USD' && '$'}
                      {(product.currency as any) === 'EUR' && '€'}
                      {(product.currency as any) === 'GBP' && '£'}
                      {commissionBreakdown.commission_amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Seller Receives</span>
                    <span className="text-green-700 font-medium">
                      {product.currency === 'USD' && '$'}
                      {(product.currency as any) === 'EUR' && '€'}
                      {(product.currency as any) === 'GBP' && '£'}
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
                  {(product.currency as any) === 'EUR' && '€'}
                  {(product.currency as any) === 'GBP' && '£'}
                  {totalAmount.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Payment released to seller upon delivery confirmation
              </p>
            </div>
          </div>

          {/* Stripe Payment Form */}
          {isLoadingPayment && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Initializing payment...</p>
            </div>
          )}

          {clientSecret && !isLoadingPayment && stripePromise && (
            <Elements stripe={stripePromise} options={{ clientSecret: clientSecret! }}>
              <CheckoutForm
                product={product}
                quantity={quantity}
                totalAmount={totalAmount}
                shippingAddress={shippingAddress}
                buyerPhone={buyerPhone}
                notes={notes}
                clientSecret={clientSecret!}
                onSuccess={onSuccess}
                onClose={onClose}
              />
            </Elements>
          )}

          {!isFormValid() && !isLoadingPayment && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                Please fill in your phone number to continue
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StripeCheckout
