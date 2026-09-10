import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  authenticateUserChatLock,
  getUserChatLockPinHash,
  isValidChatLockPin,
  setUserChatLockPinHash,
} from '@/lib/chat/chatLock'

/** POST /api/chat/lock/pin — set or replace the user's chat lock PIN. */
export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json().catch(() => ({}))

    if (!isValidChatLockPin(body.pin)) {
      return errorResponse('PIN must be 4–6 digits', 400)
    }

    const existingHash = await getUserChatLockPinHash(serviceClient, user.id)
    if (existingHash) {
      const auth = await authenticateUserChatLock(serviceClient, user, {
        pin: body.current_pin,
        password: body.password,
      })
      if (!auth.ok) return auth.response
    }

    await setUserChatLockPinHash(serviceClient, user.id, body.pin)
    return jsonResponse({ has_pin: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to save chat PIN', 500)
  }
}
