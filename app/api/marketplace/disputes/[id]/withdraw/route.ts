import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { withdrawDispute } from '@/lib/marketplace/disputeService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const { id } = await params
    const serviceClient = createServiceClient()

    const result = await withdrawDispute(serviceClient, id, user.id)

    return jsonResponse({ data: result })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, message === 'Internal server error' ? 500 : 400)
  }
}
