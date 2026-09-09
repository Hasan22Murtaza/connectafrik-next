import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { queryUserThreads } from '@/lib/chat/chatThreadsQuery'

/**
 * GET /api/chat/threads/locked
 *
 * Locked conversations for the current user. Names only — message bodies stay gated per chat.
 */
export async function GET(request: NextRequest) {
  try {
    const result = await queryUserThreads(request, { filter: 'locked' })
    return jsonResponse(result)
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to fetch locked chats', 500)
  }
}
