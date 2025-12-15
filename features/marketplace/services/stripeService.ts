import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js'
import { supabase } from '@/lib/supabase'

// Initialize Stripe
let stripePromise: Promise<Stripe | null>

export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    if (!publishableKey) {
      console.error('Stripe publishable key not found')
      return null
    }
    stripePromise = loadStripe(publishableKey)
  }
  return stripePromise
}

/**
 * Stripe-supported currencies for ConnectAfrik
 */
export const STRIPE_CURRENCIES = ['USD', 'EUR', 'GBP'] as const
export type StripeCurrency = typeof STRIPE_CURRENCIES[number]

/**
 * Calculate Stripe fees by currency
 * Source: https://stripe.com/pricing
 */
export function calculateStripeFees(amount: number, currency: string): {
  gateway_fee: number
  platform_fee_share: number
  seller_fee_share: number
} {
  let percentageFee = 0
  let flatFee = 0

  switch (currency) {
    case 'USD':
      percentageFee = 0.029 // 2.9%
      flatFee = 0.30 // $0.30
      break
    case 'EUR':
      percentageFee = 0.029 // 2.9%
      flatFee = 0.25 // €0.25
      break
    case 'GBP':
      percentageFee = 0.029 // 2.9%
      flatFee = 0.20 // £0.20
      break
    default:
      // International cards
      percentageFee = 0.039 // 3.9%
      flatFee = 0
  }

  // Calculate gateway fee
  const gateway_fee = Math.round((amount * percentageFee + flatFee) * 100) / 100

  // Split fee: Platform 5%, Seller 95%
  const platform_fee_share = Math.round(gateway_fee * 0.05 * 100) / 100
  const seller_fee_share = Math.round(gateway_fee * 0.95 * 100) / 100

  return {
    gateway_fee,
    platform_fee_share,
    seller_fee_share
  }
}

/**
 * Create Stripe payment intent
 * Note: Secret key is stored securely in Supabase Edge Functions
 */
export async function createStripePaymentIntent(
  amount: number,
  currency: string,
  metadata: Record<string, string>
): Promise<{ clientSecret: string; paymentIntentId: string } | null> {
  try {
    // Call backend edge function to create payment intent
    // Secret key is securely stored in Supabase, not exposed to frontend
    const { data, error } = await supabase.functions.invoke('create-stripe-payment', {
      body: {
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        metadata
      }
    })

    if (error) {
      console.error('Supabase function error:', error)
      throw error
    }

    if (!data || !data.clientSecret) {
      console.error('Invalid response from payment function:', data)
      throw new Error('Invalid response from payment service')
    }

    return {
      clientSecret: data.clientSecret,
      paymentIntentId: data.paymentIntentId
    }
  } catch (error) {
    console.error('Error creating Stripe payment intent:', error)
    return null
  }
}

/**
 * Verify Stripe payment
 */
export async function verifyStripePayment(paymentIntentId: string): Promise<{
  success: boolean
  status: string
  amount?: number
  currency?: string
}> {
  try {
    // Call backend edge function to verify payment
    const { data, error } = await supabase.functions.invoke('verify-stripe-payment', {
      body: { paymentIntentId }
    })

    if (error) throw error

    return {
      success: data.status === 'succeeded',
      status: data.status,
      amount: data.amount ? data.amount / 100 : undefined,
      currency: data.currency?.toUpperCase()
    }
  } catch (error) {
    console.error('Error verifying Stripe payment:', error)
    return { success: false, status: 'error' }
  }
}

/**
 * Create Stripe payout (for seller withdrawals)
 */
export async function createStripePayout(
  sellerId: string,
  amount: number,
  currency: string,
  destination: string // Stripe Connect account ID or bank account token
): Promise<{ success: boolean; payoutId?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('create-stripe-payout', {
      body: {
        sellerId,
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        destination
      }
    })

    if (error) throw error

    return {
      success: true,
      payoutId: data.payoutId
    }
  } catch (error: any) {
    console.error('Error creating Stripe payout:', error)
    return {
      success: false,
      error: error.message || 'Payout failed'
    }
  }
}
