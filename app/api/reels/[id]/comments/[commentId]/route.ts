import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id: reelId, commentId } = await params
    const { user } = await getAuthenticatedUser(request)
    const supabase = createServiceClient()

    const { data: comment } = await supabase
      .from('reel_comments')
      .select('id, user_id, reel_id, is_deleted')
      .eq('id', commentId)
      .eq('reel_id', reelId)
      .maybeSingle()

    if (!comment || comment.is_deleted) return errorResponse('Comment not found', 404)

    const { data: reel } = await supabase
      .from('reels')
      .select('author_id')
      .eq('id', reelId)
      .maybeSingle()

    const isCommentOwner = comment.user_id === user.id
    const isReelOwner = reel?.author_id === user.id
    if (!isCommentOwner && !isReelOwner) {
      return errorResponse('You can only delete your own comments', 403)
    }

    const { data: deleted, error } = await supabase
      .from('reel_comments')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('reel_id', reelId)
      .select('id')
      .maybeSingle()

    if (error) return errorResponse(error.message, 400)
    if (!deleted) return errorResponse('Comment not found', 404)
    return jsonResponse({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(err.message || 'Failed to delete comment', 500)
  }
}
