import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chatThreadAccess'

type RouteContext = { params: Promise<{ threadId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json()
    const messageIds = body.message_ids as string[] | undefined
    const recalculateOnly =
      body.recalculate === true &&
      (!Array.isArray(messageIds) || messageIds.length === 0)

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    if (recalculateOnly) {
      const { error: recalcErr } = await serviceClient.rpc('chat_recalc_participant_unread', {
        p_thread_id: threadId,
        p_user_id: user.id,
      })
      if (recalcErr) return errorResponse(recalcErr.message, 400)
      return jsonResponse({ success: true })
    }

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return errorResponse('message_ids is required and must be a non-empty array', 400)
    }

    const rows = messageIds.map((message_id: string) => ({
      message_id,
      user_id: user.id,
    }))

    const { error } = await serviceClient.from('message_reads').upsert(rows, {
      onConflict: 'message_id,user_id',
    })

    if (error) return errorResponse(error.message, 400)

    const { error: recalcErr } = await serviceClient.rpc('chat_recalc_participant_unread', {
      p_thread_id: threadId,
      p_user_id: user.id,
    })
    if (recalcErr) return errorResponse(recalcErr.message, 400)

    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to mark as read', 500)
  }
}
