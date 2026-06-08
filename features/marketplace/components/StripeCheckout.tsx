'use client'

import React, { useState, useEffect } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Phone } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'
import { Product } from '@/shared/types'
import { getStripe, createStripePaymentIntent } from '@/features/marketplace/services/stripeService'
import CheckoutPageShell from '@/features/marketplace/components/CheckoutPageShell'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import toast from 'react-hot-toast'

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

const sendNewOrderNotificationEmail = async (sellerEmail: string, orderDetails: any, sellerId?: string) => {
  try {
    const response = await fetch('/api/email/order-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sellerId, sellerEmail, orderDetails }),
    })
    return response.ok
  } catch (error) {
    console.error('Error sending order notification email:', error)
    return false
  }
}

interface StripeCheckoutProps {
  product: Product
  onCancel: () => void
  onSuccess: () => void
}

const PHONE_INPUT_CLASS =
  '[&_.PhoneInput]:flex [&_.PhoneInput]:items-center [&_.PhoneInput]:border [&_.PhoneInput]:border-gray-300 [&_.PhoneInput]:rounded-xl [&_.PhoneInput]:bg-gray-50 [&_.PhoneInput]:px-3 [&_.PhoneInput]:py-3 [&_.PhoneInputInput]:w-full [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:focus:outline-none [&_.PhoneInputInput]:focus:ring-0 [&_.PhoneInputCountry]:mr-2 [&_.PhoneInput]:focus-within:border-primary-500 [&_.PhoneInput]:focus-within:shadow-[0_0_0_3px_rgba(249,115,22,0.12)]'

const CheckoutForm: React.FC<{
  product: Product
  quantity: number
  totalAmount: number
  buyerPhone: string
  notes: string
  onSuccess: () => void
  onCancel: () => void
}> = ({
  product,
  quantity,
  totalAmount,
  buyerPhone,
  notes,
  onSuccess,
  onCancel,
}) => {
  const { user } = useAuth()
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) return

    setIsProcessing(true)

    try {
      if (!stripe || !elements) {
        toast.error('Payment form is still initializing. Please wait a moment.')
        setIsProcessing(false)
        return
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: typeof window !== 'undefined' ? window.location.href : '/marketplace',
        },
        redirect: 'if_required'
      })

      if (stripeError) {
        toast.error(stripeError.message || 'Payment failed')
        setIsProcessing(false)
        return
      }

      if (paymentIntent?.status === 'succeeded') {
        const result = await apiClient.post<{ data: any }>('/api/marketplace/checkout/stripe/complete', {
          payment_reference: paymentIntent.id,
          product_id: product.id,
          product_title: product.title,
          product_image: product.images?.[0] || null,
          seller_id: product.seller_id,
          quantity,
          unit_price: product.price,
          total_amount: totalAmount,
          currency: product.currency || 'USD',
          shipping_address: null,
          buyer_phone: buyerPhone || null,
          notes: notes || null,
        })

        const order = result.data
        const buyerEmail = user?.user_metadata?.email || user?.email || 'support@connectafrik.com'
        const buyerName = user?.user_metadata?.full_name || user?.id || 'Customer'
        const sellerName = product.seller?.full_name || product.seller?.id || 'Seller'

        sendOrderConfirmationEmail(buyerEmail, {
          orderNumber: order?.order_number,
          productTitle: product.title,
          quantity,
          totalAmount,
          currency: product.currency || 'USD',
          buyerName,
        }).catch(err => console.error('Failed to send buyer confirmation:', err))

        if (product.seller_id) {
          sendNewOrderNotificationEmail('', {
            orderNumber: order?.order_number,
            productTitle: product.title,
            quantity,
            totalAmount,
            currency: product.currency || 'USD',
            buyerName,
            sellerName,
          }, product.seller_id).catch(err => console.error('Failed to send seller notification:', err))
        }

        toast.success('Payment successful! Order created.')
        onSuccess()
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Payment</h3>
        <p className="text-sm text-gray-500 mt-1">Pay securely with card or supported wallets.</p>
      </div>

      <PaymentElement />

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isProcessing || !stripe || !elements}
          className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Processing...' : 'Complete purchase'}
        </button>
      </div>

      <p className="text-xs text-center text-gray-500">
        Secure payment powered by Stripe.
      </p>
    </form>
  )
}

const StripeCheckout: React.FC<StripeCheckoutProps> = ({
  product,
  onCancel,
  onSuccess
}) => {
  const { user } = useAuth()
  const [quantity, setQuantity] = useState(1)
  const [buyerPhone, setBuyerPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isLoadingPayment, setIsLoadingPayment] = useState(false)

  const totalAmount = product.price * quantity
  const stripePromise = getStripe()

  const isFormValid = () =>
    quantity > 0 &&
    quantity <= (product.stock_quantity || Infinity) &&
    buyerPhone.trim() !== ''

  useEffect(() => {
    setClientSecret(null)
  }, [quantity, buyerPhone])

  useEffect(() => {
    if (!user || !buyerPhone.trim() || !isFormValid()) return

    let cancelled = false
    setIsLoadingPayment(true)

    createStripePaymentIntent(totalAmount, product.currency || 'USD', {
      product_id: product.id,
      product_title: product.title,
      quantity: quantity.toString(),
      buyer_id: user.id,
      buyer_email: user?.email || 'support@connectafrik.com'
    }).then(result => {
      if (cancelled) return
      if (result) {
        setClientSecret(result.clientSecret)
      } else {
        toast.error('Failed to initialize payment')
      }
      setIsLoadingPayment(false)
    })

    return () => {
      cancelled = true
    }
  }, [user, buyerPhone, totalAmount, product, quantity])

  if (!user) return null

  return (
    <CheckoutPageShell
      product={product}
      quantity={quantity}
      onQuantityChange={setQuantity}
      onBack={onCancel}
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Contact details</h3>
          <p className="text-sm text-gray-500 mt-1">
            The seller will reach you on this number about your order.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Phone className="w-4 h-4 inline mr-1" />
            Phone number
          </label>
          <div className={PHONE_INPUT_CLASS}>
            <PhoneInput
              international
              defaultCountry="US"
              value={buyerPhone}
              onChange={(value) => setBuyerPhone(value || '')}
              placeholder="Enter your phone number"
              className="w-full"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Order notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the seller should know before fulfilling your order..."
            rows={3}
            className="input-field resize-none rounded-xl"
          />
        </div>

      

        {isFormValid() && isLoadingPayment && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
            <p className="text-sm text-gray-500 mt-3">Preparing secure payment...</p>
          </div>
        )}

        {isFormValid() && clientSecret && !isLoadingPayment && stripePromise && (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm
              product={product}
              quantity={quantity}
              totalAmount={totalAmount}
              buyerPhone={buyerPhone}
              notes={notes}
              onSuccess={onSuccess}
              onCancel={onCancel}
            />
          </Elements>
        )}
      </div>
    </CheckoutPageShell>
  )
}

export default StripeCheckout
