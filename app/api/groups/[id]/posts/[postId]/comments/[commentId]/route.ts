import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string; postId: string; commentId: string }> }

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { postId, commentId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { error } = await supabase
      .from('group_post_comments')
      .delete()
      .eq('id', commentId)
      .eq('author_id', user.id)

    if (error) {
      return errorResponse(error.message, 400)
    }

    try {
      const { data: post } = await supabase
        .from('group_posts')
        .select('comments_count')
        .eq('id', postId)
        .single()
      await supabase
        .from('group_posts')
        .update({ comments_count: Math.max(0, (post?.comments_count ?? 1) - 1) })
        .eq('id', postId)
    } catch {
      // best-effort decrement
    }

    return jsonResponse({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to delete comment', 500)
  }
}
