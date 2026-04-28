import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chatThreadAccess'
import {
  ensureChatParticipantsForThread,
  insertGroupMembershipSystemMessage,
} from '@/lib/groupChatSystemMessages'

type RouteContext = { params: Promise<{ threadId: string }> }

type ExistingParticipantRow = { user_id: string }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const { data: thread, error: threadError } = await serviceClient
      .from('chat_threads')
      .select('id')
      .eq('id', threadId)
      .maybeSingle()

    if (threadError) return errorResponse(threadError.message, 400)
    if (!thread) return errorResponse('Thread not found', 404)

    const body = await request.json().catch(() => ({}))
    const userIdsRaw: unknown[] = Array.isArray(body?.user_ids) ? body.user_ids : []
    const userIds = Array.from(
      new Set<string>(
        userIdsRaw
          .map((id: unknown) => (typeof id === 'string' ? id.trim() : ''))
          .filter((id: string) => Boolean(id))
      )
    ).filter((id: string) => id !== user.id)

    if (userIds.length === 0) {
      return errorResponse('user_ids is required and must contain at least one user id', 400)
    }

    const { data: existingRows, error: existingError } = await serviceClient
      .from('chat_participants')
      .select('user_id')
      .eq('thread_id', threadId)
      .in('user_id', userIds)

    if (existingError) return errorResponse(existingError.message, 400)

    const alreadyParticipantIds = new Set(
      (existingRows || []).map((row: ExistingParticipantRow) => row.user_id)
    )
    const toAdd = userIds.filter((id) => !alreadyParticipantIds.has(id))
    const alreadyParticipantList = userIds.filter((id) => alreadyParticipantIds.has(id))

    if (toAdd.length > 0) {
      try {
        await ensureChatParticipantsForThread(serviceClient, threadId, toAdd)
        for (const uid of toAdd) {
          await insertGroupMembershipSystemMessage(serviceClient, {
            threadId,
            subjectUserId: uid,
            kind: 'joined',
          })
        }
      } catch (chatErr) {
        console.error('Chat thread invite: participant sync failed', chatErr)
        return errorResponse(
          chatErr instanceof Error ? chatErr.message : 'Failed to add participants',
          400
        )
      }
    }

    const { count } = await serviceClient
      .from('chat_participants')
      .select('id', { count: 'exact', head: true })
      .eq('thread_id', threadId)

    return jsonResponse({
      added_user_ids: toAdd,
      already_participant_user_ids: alreadyParticipantList,
      added_count: toAdd.length,
      already_participant_count: alreadyParticipantList.length,
      participant_count: count ?? undefined,
      thread_id: threadId,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to invite users to thread', 500)
  }
}
