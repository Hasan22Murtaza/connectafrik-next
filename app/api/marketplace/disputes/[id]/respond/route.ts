import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { respondToDispute } from '@/lib/marketplace/disputeService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const { id } = await params
    const serviceClient = createServiceClient()
    const body = await request.json()

    const response = (body.response as string)?.trim()
    if (!response) {
      return errorResponse('response is required', 400)
    }

    const result = await respondToDispute(
      serviceClient,
      id,
      user.id,
      response,
      Boolean(body.accept_buyer_claim)
    )

    return jsonResponse({ data: result })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, message === 'Internal server error' ? 500 : 400)
  }
}
