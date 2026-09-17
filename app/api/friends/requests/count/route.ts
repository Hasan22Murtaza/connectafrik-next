import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

/** GET /api/friends/requests/count — pending friend requests received by the current user. */
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const { count, error } = await supabase
      .from('friend_requests')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('status', 'pending')

    if (error) return errorResponse(error.message, 400)

    return jsonResponse({ friend_request_count: count ?? 0 })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to fetch friend request count', 500)
  }
}
