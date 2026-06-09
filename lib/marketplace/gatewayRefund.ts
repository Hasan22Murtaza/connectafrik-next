export type RefundGateway = 'paystack' | 'stripe'

export interface GatewayRefundResult {
  success: boolean
  gateway_refund_id?: string
  status?: string
  error?: string
  raw?: unknown
}

export async function refundViaPaystack(
  transactionReference: string,
  amount: number,
  currency: string
): Promise<GatewayRefundResult> {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    return { success: false, error: 'PAYSTACK_SECRET_KEY not configured' }
  }

  const body: Record<string, unknown> = { transaction: transactionReference }
  const minorUnitCurrencies = ['NGN', 'GHS', 'KES', 'ZAR']
  if (minorUnitCurrencies.includes(currency.toUpperCase())) {
    body.amount = Math.round(amount * 100)
  }

  try {
    const response = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const payload = (await response.json()) as {
      status?: boolean
      message?: string
      data?: { id?: number; transaction?: { reference?: string }; status?: string }
    }

    if (!response.ok || !payload.status) {
      return {
        success: false,
        error: payload.message || `Paystack refund failed (${response.status})`,
        raw: payload,
      }
    }

    return {
      success: true,
      gateway_refund_id: String(payload.data?.id ?? payload.data?.transaction?.reference ?? ''),
      status: payload.data?.status || 'processing',
      raw: payload,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Paystack refund request failed'
    return { success: false, error: message }
  }
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
  gateway: RefundGateway,
  paymentReference: string,
  amount: number,
  currency: string
): Promise<GatewayRefundResult> {
  if (gateway === 'paystack') {
    return refundViaPaystack(paymentReference, amount, currency)
  }
  return refundViaStripe(paymentReference, amount)
}
