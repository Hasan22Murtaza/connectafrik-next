import crypto from 'crypto'

export function verifyStripeWebhookSignature(
  rawBody: string,
  signature: string | null
): { valid: boolean; event?: Record<string, unknown> } {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !signature) return { valid: false }

  const elements = signature.split(',')
  const timestamp = elements.find((e) => e.startsWith('t='))?.slice(2)
  const sig = elements.find((e) => e.startsWith('v1='))?.slice(3)

  if (!timestamp || !sig) return { valid: false }

  const payload = `${timestamp}.${rawBody}`
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')

  if (expected !== sig) return { valid: false }

  try {
    const event = JSON.parse(rawBody) as Record<string, unknown>
    return { valid: true, event }
  } catch {
    return { valid: false }
  }
}
