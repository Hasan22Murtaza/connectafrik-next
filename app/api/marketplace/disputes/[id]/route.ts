import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { isMarketplaceAdmin } from '@/lib/marketplace/adminAuth'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getDisputeDetail } from '@/lib/marketplace/disputeService'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const { id } = await params
    const serviceClient = createServiceClient()

    const isAdmin = await isMarketplaceAdmin(user.id)
    const detail = await getDisputeDetail(serviceClient, id, user.id, isAdmin)

    return jsonResponse({ data: detail })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status =
      message === 'Dispute not found' ? 404 :
      message === 'Unauthorized' ? 403 : 500
    return errorResponse(message, status)
  }
}
