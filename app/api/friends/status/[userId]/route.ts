import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    if (!userId || userId === user.id) {
      return errorResponse('Invalid user', 400)
    }

    const { data: rows, error } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      return errorResponse(error.message, 400)
    }

    const list = rows || []

    const accepted = list.find((r: any) => r.status === 'accepted')
    if (accepted) {
      return jsonResponse({ status: 'friends', request_id: accepted.id })
    }

    const pendingSent = list.find((r: any) => r.status === 'pending' && r.sender_id === user.id)
    if (pendingSent) {
      return jsonResponse({ status: 'pending_sent', request_id: pendingSent.id })
    }

    const pendingReceived = list.find((r: any) => r.status === 'pending' && r.receiver_id === user.id)
    if (pendingReceived) {
      return jsonResponse({ status: 'pending_received', request_id: pendingReceived.id })
    }

    return jsonResponse({ status: 'none', request_id: null })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to get friendship status', 500)
  }
}
