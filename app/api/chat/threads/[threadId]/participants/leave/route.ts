import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  insertGroupMembershipSystemMessage,
  removeChatParticipantFromThread,
} from '@/lib/groupChatSystemMessages'

type RouteContext = { params: Promise<{ threadId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const { data: participantRow, error: participantError } = await serviceClient
      .from('chat_participants')
      .select('id')
      .eq('thread_id', threadId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (participantError) return errorResponse(participantError.message, 400)
    if (!participantRow) {
      return errorResponse('You are not a participant in this thread', 400)
    }

    try {
      await insertGroupMembershipSystemMessage(serviceClient, {
        threadId,
        subjectUserId: user.id,
        kind: 'left',
      })
    } catch (msgErr) {
      console.error('Thread leave: system message failed', msgErr)
    }
    try {
      await removeChatParticipantFromThread(serviceClient, threadId, user.id)
    } catch (partErr) {
      console.error('Thread leave: remove participant failed', partErr)
      return errorResponse(
        partErr instanceof Error ? partErr.message : 'Failed to leave thread',
        400
      )
    }

    return jsonResponse({
      success: true,
      left_thread: true,
      thread_id: threadId,
      receives_messages: false,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to leave thread', 500)
  }
}
