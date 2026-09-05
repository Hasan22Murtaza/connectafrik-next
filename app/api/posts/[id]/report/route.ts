import { NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { createPostReport, isPostReportReason } from '@/lib/reports/reportService'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const { id: postId } = await context.params
    const body = await request.json().catch(() => ({}))
    const reason = body?.reason

    if (!isPostReportReason(reason)) {
      return errorResponse('Please select a valid report reason', 400)
    }

    const serviceClient = createServiceClient()
    await createPostReport(serviceClient, {
      post_id: postId,
      reported_by: user.id,
      reason,
    })

    return jsonResponse(
      { submitted: true },
      201,
      'Thanks for reporting. We\'ll review this post.'
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to submit report'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    if (message.includes('already reported')) {
      return errorResponse(message, 409)
    }
    if (
      message.includes('cannot report') ||
      message.includes('valid report reason') ||
      message.includes('Invalid post')
    ) {
      return errorResponse(message, 400)
    }
    if (message.includes('not found')) {
      return errorResponse(message, 404)
    }
    return errorResponse(message, 500)
  }
}
