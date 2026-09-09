import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chat/chatThreadAccess'
import {
  authenticateThreadChatLock,
  getThreadLockPinHash,
  isValidChatLockPin,
  setThreadLockPinHash,
} from '@/lib/chat/chatLock'

/** POST /api/chat/lock/pin — set or replace the PIN for one chat. */
export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json().catch(() => ({}))
    const threadId = typeof body.thread_id === 'string' ? body.thread_id.trim() : ''

    if (!threadId) {
      return errorResponse('thread_id is required', 400)
    }
    if (!isValidChatLockPin(body.pin)) {
      return errorResponse('PIN must be 4–6 digits', 400)
    }

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const existingHash = await getThreadLockPinHash(serviceClient, user.id, threadId)
    if (existingHash) {
      const auth = await authenticateThreadChatLock(serviceClient, user, threadId, {
        pin: body.current_pin,
        password: body.password,
      })
      if (!auth.ok) return auth.response
    }

    await setThreadLockPinHash(serviceClient, user.id, threadId, body.pin)
    return jsonResponse({ thread_id: threadId, has_pin: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to save chat PIN', 500)
  }
}
