'use client'

import React from 'react'
import { Product } from '@/shared/types'
import StripeCheckout from '@/features/marketplace/components/StripeCheckout'

interface SmartCheckoutProps {
  product: Product
  onCancel: () => void
  onSuccess: () => void
}

/**
 * Checkout — all marketplace payments are processed via Stripe.
 */
const SmartCheckout: React.FC<SmartCheckoutProps> = ({
  product,
  onCancel,
  onSuccess
}) => {
  return (
    <StripeCheckout
      product={product}
      onCancel={onCancel}
      onSuccess={onSuccess}
    />
  )
}

export default SmartCheckout
