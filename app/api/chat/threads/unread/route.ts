import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { queryUserThreads } from '@/lib/chatThreadsQuery'

/**
 * GET /api/chat/threads/unread
 *
 * Returns the authenticated user's unread chat threads (WhatsApp-style
 * "Unread" filter): active threads (not archived / blocked) whose
 * `chat_participants.unread_count` is greater than zero. Accepts an optional
 * `category` (`general` | `marketplace`) plus `limit` and `page` query params.
 */
export async function GET(request: NextRequest) {
  try {
    const result = await queryUserThreads(request, { filter: 'unread' })
    return jsonResponse(result)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch unread threads', 500)
  }
}
