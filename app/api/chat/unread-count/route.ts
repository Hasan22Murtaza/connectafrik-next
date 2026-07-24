import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getTotalUnreadMessageCount } from '@/lib/chatHeaderCounts'

/** GET /api/chat/unread-count — total unread messages across all active chats. */
export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const unreadCount = await getTotalUnreadMessageCount(serviceClient, user.id)
    return jsonResponse({ data: { unread_count: unreadCount } })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to fetch unread chat count', 500)
  }
}
