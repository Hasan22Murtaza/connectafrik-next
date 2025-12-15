import React from 'react'
import { Product } from '@/shared/types'
import PaystackCheckout from '@/features/marketplace/components/PaystackCheckout'
import StripeCheckout from '@/features/marketplace/components/StripeCheckout'

interface SmartCheckoutProps {
  product: Product
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

/**
 * Smart Checkout Router
 *
 * Automatically selects the appropriate payment gateway based on currency:
 * - Paystack: NGN, GHS, ZAR, KES (African currencies)
 * - Stripe: USD, EUR, GBP (Western currencies)
 *
 * This provides optimal fees and local payment methods for each region.
 */
const SmartCheckout: React.FC<SmartCheckoutProps> = ({
  product,
  isOpen,
  onClose,
  onSuccess
}) => {
  // Define which currencies are supported by each gateway
  const PAYSTACK_CURRENCIES = ['NGN', 'GHS', 'ZAR', 'KES']
  const STRIPE_CURRENCIES = ['USD', 'EUR', 'GBP']

  const currency = product.currency || 'USD'

  // Auto-select payment gateway based on currency
  const usePaystack = PAYSTACK_CURRENCIES.includes(currency)
  const useStripe = STRIPE_CURRENCIES.includes(currency)

  // Fallback: If currency not recognized, try Stripe
  if (!usePaystack && !useStripe) {
    console.warn(`Currency ${currency} not explicitly supported. Defaulting to Stripe.`)
  }

  // Render the appropriate checkout component
  if (usePaystack) {
    return (
      <PaystackCheckout
        product={product}
        isOpen={isOpen}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    )
  }

  // Default to Stripe for USD, EUR, GBP and unsupported currencies
  return (
    <StripeCheckout
      product={product}
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  )
}

export default SmartCheckout
