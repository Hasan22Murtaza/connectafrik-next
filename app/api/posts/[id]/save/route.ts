import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: postRow, error: postErr } = await supabase
      .from('posts')
      .select('id, author_id, is_deleted')
      .eq('id', postId)
      .maybeSingle()

    if (postErr || !postRow || postRow.is_deleted) {
      return errorResponse('Post not found', 404)
    }

    if (postRow.author_id === user.id) {
      return errorResponse('You cannot save your own post', 400)
    }

    const { data: existing } = await supabase
      .from('post_saves')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      const { error: delErr } = await supabase
        .from('post_saves')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id)
      if (delErr) return errorResponse(delErr.message, 400)
      return jsonResponse({ saved: false })
    }

    const { error: insErr } = await supabase
      .from('post_saves')
      .insert({ post_id: postId, user_id: user.id })
    if (insErr) return errorResponse(insErr.message, 400)

    return jsonResponse({ saved: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to update saved post', 500)
  }
}
