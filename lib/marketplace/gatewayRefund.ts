export type RefundGateway = 'stripe'

export interface GatewayRefundResult {
  success: boolean
  gateway_refund_id?: string
  status?: string
  error?: string
  raw?: unknown
}

export async function refundViaStripe(
  paymentIntentId: string,
  amount: number
): Promise<GatewayRefundResult> {
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  if (!stripeSecret) {
    return { success: false, error: 'STRIPE_SECRET_KEY not configured' }
  }

  try {
    const params = new URLSearchParams()
    params.append('payment_intent', paymentIntentId)
    params.append('amount', String(Math.round(amount * 100)))

    const response = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const payload = (await response.json()) as {
      id?: string
      status?: string
      error?: { message?: string }
    }

    if (!response.ok) {
      return {
        success: false,
        error: payload.error?.message || `Stripe refund failed (${response.status})`,
        raw: payload,
      }
    }

    return {
      success: true,
      gateway_refund_id: payload.id,
      status: payload.status,
      raw: payload,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Stripe refund request failed'
    return { success: false, error: message }
  }
}

export async function processGatewayRefund(
  _gateway: RefundGateway,
  paymentReference: string,
  amount: number,
  _currency: string
): Promise<GatewayRefundResult> {
  return refundViaStripe(paymentReference, amount)
}
