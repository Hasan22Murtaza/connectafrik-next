import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { verifyStripeWebhookSignature } from '@/lib/marketplace/stripeWebhook'
import { handleStripeDisputeWebhook } from '@/lib/marketplace/chargebackService'
import { syncConnectAccountStatus } from '@/lib/marketplace/stripeConnect'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('stripe-signature')
    const { valid, event } = verifyStripeWebhookSignature(rawBody, signature)

    if (!valid || !event) {
      return errorResponse('Invalid Stripe webhook signature', 401)
    }

    const eventType = String(event.type ?? '')
    const dataObject = (event.data as { object?: Record<string, unknown> })?.object ?? {}
    const serviceClient = createServiceClient()

    if (eventType.startsWith('charge.dispute.') || eventType === 'charge.dispute.created') {
      const result = await handleStripeDisputeWebhook(serviceClient, dataObject)
      return jsonResponse({ received: true, ...result })
    }

    if (
      eventType === 'account.updated' &&
      dataObject.id &&
      typeof dataObject.id === 'string'
    ) {
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('id')
        .eq('stripe_connect_account_id', dataObject.id)
        .maybeSingle()

      if (profile) {
        await syncConnectAccountStatus(serviceClient, profile.id)
      }

      return jsonResponse({ received: true, action: 'account_synced' })
    }

    return jsonResponse({ received: true, skipped: true, event: eventType })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Stripe webhook failed'
    console.error('Stripe webhook error:', message)
    return errorResponse(message, 500)
  }
}
