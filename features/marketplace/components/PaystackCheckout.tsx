'use client'

import React, { useState } from 'react'
import { Phone } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Product } from '@/shared/types'
import { initializePaystackTransaction } from '@/features/marketplace/services/paystackService'
import CheckoutPageShell from '@/features/marketplace/components/CheckoutPageShell'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import toast from 'react-hot-toast'

interface PaystackCheckoutProps {
  product: Product
  onCancel: () => void
  onSuccess: () => void
}

const PHONE_INPUT_CLASS =
  '[&_.PhoneInput]:flex [&_.PhoneInput]:items-center [&_.PhoneInput]:border [&_.PhoneInput]:border-gray-300 [&_.PhoneInput]:rounded-xl [&_.PhoneInput]:bg-gray-50 [&_.PhoneInput]:px-3 [&_.PhoneInput]:py-3 [&_.PhoneInputInput]:w-full [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:focus:outline-none [&_.PhoneInputInput]:focus:ring-0 [&_.PhoneInputCountry]:mr-2 [&_.PhoneInput]:focus-within:border-primary-500 [&_.PhoneInput]:focus-within:shadow-[0_0_0_3px_rgba(249,115,22,0.12)]'

const PaystackCheckout: React.FC<PaystackCheckoutProps> = ({
  product,
  onCancel,
  onSuccess: _onSuccess,
}) => {
  const { user } = useAuth()
  const [quantity, setQuantity] = useState(1)
  const [buyerPhone, setBuyerPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const totalAmount = product.price * quantity

  if (!user) return null

  const handleInitializePayment = async () => {
    setIsProcessing(true)
    try {
      const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/api/paystack/verify`

      const result = await initializePaystackTransaction(
        totalAmount,
        user?.user_metadata?.email || user?.email || '',
        product.currency || 'USD',
        {
          product_id: product.id,
          product_title: product.title,
          quantity,
          buyer_id: user?.id,
          buyer_email: user?.email,
          buyer_name: user?.user_metadata?.full_name || user?.email,
          buyer_phone: buyerPhone,
          shipping_address: null,
          notes,
          seller_id: product.seller_id,
          unit_price: product.price,
          total_amount: totalAmount,
          currency: product.currency || 'USD'
        },
        callbackUrl
      )

      if (result?.authorization_url) {
        window.location.href = result.authorization_url
      } else {
        toast.error('Unable to start payment')
      }
    } catch (err) {
      console.error('Init Paystack failed', err)
      toast.error('Payment initialization failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const isFormValid = () =>
    quantity > 0 &&
    quantity <= (product.stock_quantity || Infinity) &&
    buyerPhone.trim() !== ''

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
              disabled={isProcessing}
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
            disabled={isProcessing}
            className="input-field resize-none rounded-xl"
          />
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-900">Payment</h3>
          <p className="text-sm text-gray-500 mt-1">
            You&apos;ll be redirected to Paystack to complete payment securely.
          </p>
        </div>

        {!isFormValid() && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-800">Enter your phone number to continue.</p>
          </div>
        )}

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
            type="button"
            onClick={handleInitializePayment}
            disabled={isProcessing || !isFormValid()}
            className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Redirecting...' : 'Continue to payment'}
          </button>
        </div>

        <p className="text-xs text-center text-gray-500">
          Secure payment powered by Paystack.
        </p>
      </div>
    </CheckoutPageShell>
  )
}

export default PaystackCheckout
