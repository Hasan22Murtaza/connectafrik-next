import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireMarketplaceAdmin } from '@/lib/marketplace/adminAuth'
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { issueOrderRefund } from '@/lib/marketplace/refundService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { user } = await requireMarketplaceAdmin(request)
    const { orderId } = await params
    const serviceClient = createServiceClient()
    const body = await request.json()

    const amount = body.amount != null ? Number(body.amount) : undefined
    const reason = (body.reason as string)?.trim() || 'Admin refund'

    if (amount != null && (Number.isNaN(amount) || amount <= 0)) {
      return errorResponse('Refund amount must be a positive number', 400)
    }

    const result = await issueOrderRefund(serviceClient, orderId, {
      amount,
      reason,
      initiatedBy: user.id,
      initiatorRole: 'admin',
      markCancelled: Boolean(body.mark_cancelled),
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
