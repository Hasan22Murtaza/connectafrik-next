import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chatThreadAccess'
import {
  CHAT_THREAD_DETAIL_SELECT,
  getMyThreadParticipantPrefs,
  threadToResponseBody,
} from '@/lib/chatThreadDetail'

type RouteContext = { params: Promise<{ threadId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const body = await request.json()
    const pinned = body.pinned

    if (typeof pinned !== 'boolean') {
      return errorResponse('pinned is required and must be a boolean', 400)
    }

    const pinnedAt = pinned ? new Date().toISOString() : null

    const { error: updateError } = await serviceClient
      .from('chat_participants')
      .update({ pinned, pinned_at: pinnedAt })
      .eq('thread_id', threadId)
      .eq('user_id', user.id)

    if (updateError) {
      return errorResponse(updateError.message || 'Failed to update pin state', 400)
    }

    const { data: thread, error } = await serviceClient
      .from('chat_threads')
      .select(CHAT_THREAD_DETAIL_SELECT)
      .eq('id', threadId)
      .single()

    if (error || !thread) {
      return errorResponse(error?.message || 'Thread not found', 404)
    }

    const prefs = await getMyThreadParticipantPrefs(serviceClient, user.id, threadId)
    return jsonResponse(threadToResponseBody(thread as Record<string, unknown>, prefs))
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to pin thread', 500)
  }
}
