import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { isMarketplaceAdmin } from '@/lib/marketplace/adminAuth'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { addDisputeMessage } from '@/lib/marketplace/disputeService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const { id } = await params
    const serviceClient = createServiceClient()
    const body = await request.json()

    const message = (body.message as string)?.trim()
    if (!message) {
      return errorResponse('message is required', 400)
    }

    const { data: dispute } = await serviceClient
      .from('disputes')
      .select('buyer_id, seller_id')
      .eq('id', id)
      .single()

    if (!dispute) {
      return errorResponse('Dispute not found', 404)
    }

    let role: 'buyer' | 'seller' | 'admin'
    const isAdmin = await isMarketplaceAdmin(user.id)

    if (dispute.buyer_id === user.id) {
      role = 'buyer'
    } else if (dispute.seller_id === user.id) {
      role = 'seller'
    } else if (isAdmin) {
      role = 'admin'
    } else {
      return errorResponse('Unauthorized', 403)
    }

    const isInternal = isAdmin && Boolean(body.is_internal)

    const row = await addDisputeMessage(
      serviceClient,
      id,
      user.id,
      role,
      message,
      isInternal
    )

    return jsonResponse({ data: row })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, message === 'Internal server error' ? 500 : 400)
  }
}
