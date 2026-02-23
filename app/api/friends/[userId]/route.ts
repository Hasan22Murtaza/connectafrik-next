import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    if (!userId || userId === user.id) {
      return errorResponse('Invalid user', 400)
    }

    const { data: rows, error: fetchError } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('status', 'accepted')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
      .limit(2)

    if (fetchError) {
      return errorResponse(fetchError.message, 400)
    }

    const row = rows?.[0]
    if (!row) {
      return errorResponse('Friendship not found', 404)
    }

    const { error: deleteError } = await supabase.from('friend_requests').delete().eq('id', row.id)

    if (deleteError) {
      return errorResponse(deleteError.message, 400)
    }

    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to unfriend', 500)
  }
}
