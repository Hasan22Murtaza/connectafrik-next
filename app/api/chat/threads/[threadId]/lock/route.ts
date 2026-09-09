import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chat/chatThreadAccess'
import {
  CHAT_THREAD_DETAIL_SELECT,
  getMyThreadParticipantPrefs,
  threadToResponseBody,
} from '@/lib/chat/chatThreadDetail'
import {
  authenticateThreadChatLock,
  isChatLockUnlockedForRequest,
  isValidChatLockPin,
  setThreadLockedForUser,
} from '@/lib/chat/chatLock'

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

    const body = await request.json().catch(() => ({}))
    const locked = body.locked

    if (typeof locked !== 'boolean') {
      return errorResponse('locked is required and must be a boolean', 400)
    }

    if (locked) {
      if (!isValidChatLockPin(body.pin)) {
        return errorResponse('A 4–6 digit PIN is required to lock this chat', 400)
      }
      await setThreadLockedForUser(serviceClient, user.id, threadId, true, body.pin)
    } else {
      const sessionUnlocked = isChatLockUnlockedForRequest(request, user.id, threadId)
      if (!sessionUnlocked) {
        const auth = await authenticateThreadChatLock(serviceClient, user, threadId, body)
        if (!auth.ok) return auth.response
      }
      await setThreadLockedForUser(serviceClient, user.id, threadId, false)
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
    return errorResponse(err.message || 'Failed to update chat lock', 500)
  }
}
