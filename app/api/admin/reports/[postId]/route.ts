import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireMarketplaceAdmin } from '@/lib/marketplace/adminAuth'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { getReportGroupDetail } from '@/lib/reports/reportService'

type RouteContext = { params: Promise<{ postId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireMarketplaceAdmin(request)
    const { postId } = await context.params
    const serviceClient = createServiceClient()
    const detail = await getReportGroupDetail(serviceClient, postId, {
      markUnderReview: true,
      reviewerId: user.id,
    })

    if (!detail) {
      return errorResponse('Report not found', 404)
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
