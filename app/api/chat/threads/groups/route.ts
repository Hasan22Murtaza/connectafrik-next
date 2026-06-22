import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { queryUserThreads } from '@/lib/chatThreadsQuery'

/**
 * GET /api/chat/threads/groups
 *
 * Returns the authenticated user's group chat threads (WhatsApp-style
 * "Groups" filter). Supports `limit` and `page` query params for pagination.
 */
export async function GET(request: NextRequest) {
  try {
    const result = await queryUserThreads(request, { filter: 'groups' })
    return jsonResponse(result)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch group threads', 500)
  }
}
