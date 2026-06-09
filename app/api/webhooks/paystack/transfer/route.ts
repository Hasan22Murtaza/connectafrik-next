import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { verifyPaystackWebhookSignature } from '@/lib/marketplace/paystackWebhook'
import { handlePaystackTransferWebhook } from '@/lib/marketplace/escrowService'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-paystack-signature')

    if (!verifyPaystackWebhookSignature(rawBody, signature)) {
      return errorResponse('Invalid webhook signature', 401)
    }

    const payload = JSON.parse(rawBody) as {
      event?: string
      data?: Record<string, unknown>
    }

    const event = payload.event ?? ''
    const data = payload.data ?? {}

    if (!event.startsWith('transfer.')) {
      return jsonResponse({ received: true, skipped: true, event })
    }

    const serviceClient = createServiceClient()
    const result = await handlePaystackTransferWebhook(serviceClient, event, data)

    return jsonResponse({ received: true, ...result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed'
    console.error('Paystack transfer webhook error:', message)
    return errorResponse(message, 500)
  }
}
