import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getLockedChatSummary } from '@/lib/chat/chatLock'

/** GET /api/chat/lock/status — count only; never returns names or previews. */
export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const summary = await getLockedChatSummary(serviceClient, user.id)
    return jsonResponse(summary)
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to load chat lock status', 500)
  }
}
