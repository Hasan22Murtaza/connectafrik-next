import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { isMarketplaceAdmin } from '@/lib/marketplace/adminAuth'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { addDisputeEvidence } from '@/lib/marketplace/disputeService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const { id } = await params
    const serviceClient = createServiceClient()
    const body = await request.json()

    const { data: dispute } = await serviceClient
      .from('disputes')
      .select('buyer_id, seller_id')
      .eq('id', id)
      .single()

    if (!dispute) {
      return errorResponse('Dispute not found', 404)
    }

    let role: 'buyer' | 'seller' | 'admin'
    if (dispute.buyer_id === user.id) {
      role = 'buyer'
    } else if (dispute.seller_id === user.id) {
      role = 'seller'
    } else if (await isMarketplaceAdmin(user.id)) {
      role = 'admin'
    } else {
      return errorResponse('Unauthorized', 403)
    }

    if (!body.evidence_type) {
      return errorResponse('evidence_type is required', 400)
    }

    const evidence = await addDisputeEvidence(serviceClient, id, user.id, role, {
      evidence_type: body.evidence_type,
      file_url: body.file_url,
      description: body.description,
    })

    return jsonResponse({ data: evidence })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, message === 'Internal server error' ? 500 : 400)
  }
}
