import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chat/chatThreadAccess'
import { isChatThreadAdmin } from '@/lib/chat/chatThreadAdmin'
import {
  insertGroupMembershipSystemMessage,
  removeChatParticipantFromThread,
} from '@/lib/groupChatSystemMessages'

type RouteContext = { params: Promise<{ threadId: string }> }

/**
 * POST /api/chat/threads/:threadId/participants/remove
 * Body: { user_id: string }
 *
 * Admin-only: remove another member from the chat group.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const isAdmin = await isChatThreadAdmin(serviceClient, user.id, threadId)
    if (!isAdmin) {
      return errorResponse('Only group admins can remove members', 403)
    }

    const body = await request.json().catch(() => ({}))
    const targetUserId =
      typeof body?.user_id === 'string' ? body.user_id.trim() : ''

    if (!targetUserId) {
      return errorResponse('user_id is required', 400)
    }
    if (targetUserId === user.id) {
      return errorResponse('Use leave to remove yourself from the group', 400)
    }

    const { data: targetRow, error: targetErr } = await serviceClient
      .from('chat_participants')
      .select('user_id, role')
      .eq('thread_id', threadId)
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (targetErr) return errorResponse(targetErr.message, 400)
    if (!targetRow) {
      return errorResponse('User is not a participant in this thread', 404)
    }

    try {
      await insertGroupMembershipSystemMessage(serviceClient, {
        threadId,
        subjectUserId: targetUserId,
        kind: 'left',
      })
    } catch (msgErr) {
      console.error('Thread remove member: system message failed', msgErr)
    }

    try {
      await removeChatParticipantFromThread(serviceClient, threadId, targetUserId)
    } catch (partErr) {
      console.error('Thread remove member: delete failed', partErr)
      return errorResponse(
        partErr instanceof Error ? partErr.message : 'Failed to remove member',
        400
      )
    }

    const { count } = await serviceClient
      .from('chat_participants')
      .select('id', { count: 'exact', head: true })
      .eq('thread_id', threadId)

    return jsonResponse({
      success: true,
      removed_user_id: targetUserId,
      participant_count: count ?? undefined,
      thread_id: threadId,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to remove member', 500)
  }
}
