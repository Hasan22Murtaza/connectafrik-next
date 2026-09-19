import { NextRequest } from 'next/server'
import { getAuthenticatedUser, getAccessTokenFromRequest } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string; postId: string; commentId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId, postId, commentId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: existing } = await supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', user.id)

      if (error) return errorResponse(error.message, 400)
      return jsonResponse({ liked: false })
    }

    const { error } = await supabase
      .from('comment_likes')
      .insert({ comment_id: commentId, user_id: user.id })

    if (error) return errorResponse(error.message, 400)

    const { data: comment } = await supabase
      .from('group_post_comments')
      .select('author_id')
      .eq('id', commentId)
      .maybeSingle()

    if (comment?.author_id && comment.author_id !== user.id) {
      const { notifyIfAllowed, actorDisplayName } = await import('@/lib/notifications')
      const actorName = actorDisplayName(user)
      void notifyIfAllowed({
        recipientId: comment.author_id,
        actorId: user.id,
        type: 'post_comment_like',
        title: 'Comment Liked',
        message: `${actorName} liked your comment`,
        accessToken: getAccessTokenFromRequest(request),
        data: {
          group_id: groupId,
          post_id: postId,
          comment_id: commentId,
          actor_name: actorName,
          url: `/groups/${groupId}`,
        },
      })
    }

    return jsonResponse({ liked: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to toggle comment like', 500)
  }
}
