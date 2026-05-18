import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chatThreadAccess'

type RouteContext = { params: Promise<{ threadId: string }> }

/** WhatsApp-style delete chat for me: hide thread and clear message history for the current user only. */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const { data: clearedCount, error } = await serviceClient.rpc('delete_thread_for_user', {
      p_thread_id: threadId,
      p_user_id: user.id,
    })

    if (error) {
      const msg = error.message || 'Failed to delete chat'
      if (msg.toLowerCase().includes('not a participant')) {
        return errorResponse('Thread not found or access denied', 404)
      }
      return errorResponse(msg, 400)
    }

    return jsonResponse({
      deleted: true,
      cleared_count: Number(clearedCount ?? 0),
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to delete chat', 500)
  }
}
