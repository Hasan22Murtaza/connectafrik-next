import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string; postId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { postId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: existing } = await supabase
      .from('group_post_reactions')
      .select('id')
      .eq('group_post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle()

    let liked: boolean

    if (existing) {
      const { error } = await supabase
        .from('group_post_reactions')
        .delete()
        .eq('group_post_id', postId)
        .eq('user_id', user.id)

      if (error) return errorResponse(error.message, 400)
      liked = false

      const { data: post } = await supabase
        .from('group_posts')
        .select('likes_count')
        .eq('id', postId)
        .single()

      if (post) {
        await supabase
          .from('group_posts')
          .update({ likes_count: Math.max(0, (post.likes_count ?? 0) - 1) })
          .eq('id', postId)
      }
    } else {
      const { error } = await supabase
        .from('group_post_reactions')
        .insert({
          group_post_id: postId,
          user_id: user.id,
          reaction_type: 'like',
        })

      if (error) return errorResponse(error.message, 400)
      liked = true

      const { data: post } = await supabase
        .from('group_posts')
        .select('likes_count')
        .eq('id', postId)
        .single()

      if (post) {
        await supabase
          .from('group_posts')
          .update({ likes_count: (post.likes_count ?? 0) + 1 })
          .eq('id', postId)
      }
    }

    const { data: row } = await supabase
      .from('group_posts')
      .select('likes_count')
      .eq('id', postId)
      .single()

    return jsonResponse({
      liked,
      likes_count: row?.likes_count ?? 0,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to toggle like', 500)
  }
}
