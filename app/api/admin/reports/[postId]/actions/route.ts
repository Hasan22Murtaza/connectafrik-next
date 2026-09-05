import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireMarketplaceAdmin } from '@/lib/marketplace/adminAuth'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { applyReportAction, isPostReportActionType } from '@/lib/reports/reportService'

type RouteContext = { params: Promise<{ postId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireMarketplaceAdmin(request)
    const { postId } = await context.params
    const body = await request.json().catch(() => ({}))
    const action = body?.action

    if (!isPostReportActionType(action)) {
      return errorResponse('Invalid action', 400)
    }

    const serviceClient = createServiceClient()
    const detail = await applyReportAction(serviceClient, {
      post_id: postId,
      admin_id: user.id,
      action,
      notes: typeof body?.notes === 'string' ? body.notes : null,
      remove_post: Boolean(body?.remove_post),
    })

    return jsonResponse(detail, 200, 'Action applied')
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse()
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return forbiddenResponse()
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    if (message.includes('not found') || message.includes('No reports')) {
      return errorResponse(message, 404)
    }
    if (
      message.startsWith('Cannot manage') ||
      message.includes('Invalid')
    ) {
      return errorResponse(message, message.startsWith('Cannot manage') ? 403 : 400)
    }
    return errorResponse(message, 500)
  }
}
