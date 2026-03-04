import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string; postId: string; commentId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { commentId } = await context.params
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
    return jsonResponse({ liked: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to toggle comment like', 500)
  }
}
