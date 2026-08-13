import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { markAllCallNotificationsRead } from '@/lib/chat/chatHeaderCounts'

/**
 * PATCH /api/chat/calls/read-all
 *
 * Clears call notifications when the header Calls icon is opened:
 * marks unread call rows as read and records calls_last_viewed_at.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const result = await markAllCallNotificationsRead(serviceClient, user.id)
    return jsonResponse({ data: result })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to clear call notifications', 500)
  }
}
