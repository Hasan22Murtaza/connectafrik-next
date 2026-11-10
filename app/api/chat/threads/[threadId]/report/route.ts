import { NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chat/chatThreadAccess'
import {
  createChatUserReport,
  isPostReportReason,
  isUuid,
} from '@/lib/reports/reportService'

type RouteContext = { params: Promise<{ threadId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))
    const reason = body?.reason
    const reportedUserId = body?.reported_user_id
    const notes = body?.notes
    const messageSnapshot = body?.message_snapshot

    if (!isUuid(threadId)) {
      return errorResponse('Invalid chat', 400)
    }
    if (!isPostReportReason(reason)) {
      return errorResponse('Please select a valid report reason', 400)
    }
    if (!isUuid(reportedUserId)) {
      return errorResponse('Invalid user', 400)
    }

    const serviceClient = createServiceClient()
    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    await createChatUserReport(serviceClient, {
      thread_id: threadId,
      reported_user_id: reportedUserId,
      reported_by: user.id,
      reason,
      notes,
      message_snapshot: Array.isArray(messageSnapshot) ? messageSnapshot : undefined,
    })

    return jsonResponse(
      { submitted: true },
      201,
      "Thanks for reporting. We'll review this chat."
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
      message.includes('Invalid') ||
      message.includes('only available') ||
      message.includes('not in this chat')
    ) {
      return errorResponse(message, 400)
    }
    if (message.includes('not found') || message.includes('access denied')) {
      return errorResponse(message, 404)
    }
    return errorResponse(message, 500)
  }
}
