import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireMarketplaceAdmin } from '@/lib/marketplace/adminAuth'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { getChatReportGroupDetail } from '@/lib/reports/chatReportAdminService'

type RouteContext = { params: Promise<{ threadId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireMarketplaceAdmin(request)
    const { threadId } = await context.params
    const serviceClient = createServiceClient()
    const detail = await getChatReportGroupDetail(serviceClient, threadId, {
      markUnderReview: true,
      reviewerId: user.id,
    })

    if (!detail) {
      return errorResponse('Chat report not found', 404)
    }

    return jsonResponse(detail)
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return forbiddenResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
