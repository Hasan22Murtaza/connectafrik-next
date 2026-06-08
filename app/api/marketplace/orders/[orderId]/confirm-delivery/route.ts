import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { confirmDeliveryWithHold } from '@/lib/marketplace/escrowService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const { orderId } = await params
    const serviceClient = createServiceClient()
    const body = await request.json().catch(() => ({}))

    const trackingNumber = body.tracking_number || null

    const result = await confirmDeliveryWithHold(
      serviceClient,
      orderId,
      user.id,
      trackingNumber
    )

    return jsonResponse({ data: result })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, error instanceof Error && message !== 'Internal server error' ? 400 : 500)
  }
}
