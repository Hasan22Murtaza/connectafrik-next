import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { commentId } = await params
    const { user } = await getAuthenticatedUser(request)
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('reel_comments')
      .update({ is_deleted: true })
      .eq('id', commentId)
      .eq('user_id', user.id)

    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(err.message || 'Failed to delete comment', 500)
  }
}
