'use client'

import React from 'react'
import { Product } from '@/shared/types'
import PaystackCheckout from '@/features/marketplace/components/PaystackCheckout'
import StripeCheckout from '@/features/marketplace/components/StripeCheckout'

interface SmartCheckoutProps {
  product: Product
  onCancel: () => void
  onSuccess: () => void
}

/**
 * Smart Checkout Router
 *
 * Automatically selects the appropriate payment gateway based on currency:
 * - Paystack: NGN, GHS, ZAR, KES (African currencies)
 * - Stripe: USD, EUR, GBP (Western currencies)
 */
const SmartCheckout: React.FC<SmartCheckoutProps> = ({
  product,
  onCancel,
  onSuccess
}) => {
  const PAYSTACK_CURRENCIES = ['NGN', 'GHS', 'ZAR', 'KES']
  const STRIPE_CURRENCIES = ['USD', 'EUR', 'GBP']

  const currency = product.currency || 'USD'
  const usePaystack = PAYSTACK_CURRENCIES.includes(currency)
  const useStripe = STRIPE_CURRENCIES.includes(currency)

  if (!usePaystack && !useStripe) {
    console.warn(`Currency ${currency} not explicitly supported. Defaulting to Stripe.`)
  }

  if (usePaystack) {
    return (
      <PaystackCheckout
        product={product}
        onCancel={onCancel}
        onSuccess={onSuccess}
      />
    )
  }

  return (
    <StripeCheckout
      product={product}
      onCancel={onCancel}
      onSuccess={onSuccess}
    />
  )
}

export default SmartCheckout
