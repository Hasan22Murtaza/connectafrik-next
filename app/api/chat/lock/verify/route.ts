import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chat/chatThreadAccess'
import { authenticateThreadChatLock, createChatLockToken } from '@/lib/chat/chatLock'

/** POST /api/chat/lock/verify — unlock one locked chat. */
export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json().catch(() => ({}))
    const threadId = typeof body.thread_id === 'string' ? body.thread_id.trim() : ''

    if (!threadId) {
      return errorResponse('thread_id is required', 400)
    }

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const auth = await authenticateThreadChatLock(serviceClient, user, threadId, body)
    if (!auth.ok) return auth.response

    return jsonResponse(createChatLockToken(user.id, threadId))
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to verify chat lock', 500)
  }
}
