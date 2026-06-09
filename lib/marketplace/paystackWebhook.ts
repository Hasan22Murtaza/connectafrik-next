import crypto from 'crypto'

export function verifyPaystackWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret || !signature) return false

  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  return hash === signature
}
