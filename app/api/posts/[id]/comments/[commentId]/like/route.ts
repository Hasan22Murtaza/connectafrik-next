import { NextRequest } from 'next/server'
import { getAuthenticatedUser, getAccessTokenFromRequest } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string; commentId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId, commentId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('id, post_id, author_id')
      .eq('id', commentId)
      .eq('post_id', postId)
      .maybeSingle()

    if (commentError) {
      return errorResponse(commentError.message, 400)
    }

    const { loadPostAuthorAccess } = await import('@/lib/privacy/access')
    const postAccess = await loadPostAuthorAccess(user.id, postId, supabase)
    if (!postAccess.allowed) return errorResponse('Post not found', 404)
    if (!comment) {
      return errorResponse('Comment not found', 404)
    }

    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', user.id)
      .eq('comment_id', commentId)
      .maybeSingle()

    let liked: boolean
    if (existingLike) {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('comment_id', commentId)

      if (error) return errorResponse(error.message, 400)
      liked = false
    } else {
      const { error } = await supabase
        .from('likes')
        .insert({ user_id: user.id, comment_id: commentId })

      if (error) return errorResponse(error.message, 400)
      liked = true

      const commentAuthorId = (comment as { author_id?: string } | null)?.author_id
      if (commentAuthorId && commentAuthorId !== user.id) {
        const { notifyIfAllowed, actorDisplayName } = await import('@/lib/notifications')
        const actorName = actorDisplayName(user)
        void notifyIfAllowed({
          recipientId: commentAuthorId,
          actorId: user.id,
          type: 'post_comment_like',
          title: 'Comment Liked',
          message: `${actorName} liked your comment`,
          accessToken: getAccessTokenFromRequest(request),
          data: {
            post_id: postId,
            comment_id: commentId,
            actor_name: actorName,
            url: `/post/${postId}`,
          },
        })
      }
    }

    const { count } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('comment_id', commentId)

    return jsonResponse({ liked, likes_count: count ?? 0 })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to toggle comment like', 500)
  }
}
