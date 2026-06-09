import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireMarketplaceAdmin } from '@/lib/marketplace/adminAuth'
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { resolveDispute, ResolveOutcome } from '@/lib/marketplace/disputeService'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireMarketplaceAdmin(request)
    const { id } = await params
    const serviceClient = createServiceClient()
    const body = await request.json()

    const outcome = body.outcome as ResolveOutcome
    const resolutionNotes = (body.resolution_notes as string)?.trim()

    if (!outcome || !['buyer_wins', 'seller_wins', 'partial'].includes(outcome)) {
      return errorResponse('Valid outcome is required (buyer_wins, seller_wins, partial)', 400)
    }

    if (!resolutionNotes) {
      return errorResponse('resolution_notes is required', 400)
    }

    if (outcome === 'partial' && (body.refund_amount == null || Number(body.refund_amount) <= 0)) {
      return errorResponse('refund_amount is required for partial resolution', 400)
    }

    const result = await resolveDispute(serviceClient, id, user.id, {
      outcome,
      refundAmount: body.refund_amount != null ? Number(body.refund_amount) : undefined,
      resolutionNotes,
    })

    return jsonResponse({ data: result })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return forbiddenResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, message === 'Internal server error' ? 500 : 400)
  }
}
