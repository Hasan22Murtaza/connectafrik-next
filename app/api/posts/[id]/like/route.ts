import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_id', postId)
      .maybeSingle()

    let liked: boolean

    if (existingLike) {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', postId)

      if (error) return errorResponse(error.message, 400)
      liked = false
    } else {
      const { error } = await supabase
        .from('likes')
        .insert({ user_id: user.id, post_id: postId })

      if (error) return errorResponse(error.message, 400)
      liked = true

      // Notify post author (fire-and-forget)
      notifyPostAuthor(supabase, user, postId).catch(() => {})
    }

    // Fetch updated count
    const { count } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId)

    return jsonResponse({ liked, likes_count: count ?? 0 })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to toggle like', 500)
  }
}

async function notifyPostAuthor(supabase: any, user: any, postId: string) {
  const { data: post } = await supabase
    .from('posts')
    .select('author_id, title, content')
    .eq('id', postId)
    .single()

  if (!post || post.author_id === user.id) return

  const { sendNotification } = await import('@/shared/services/notificationService')
  const actorName = user.user_metadata?.full_name || user.email || 'Someone'
  const postTitle = post.title || post.content?.substring(0, 50) || 'your post'

  await sendNotification({
    user_id: post.author_id,
    title: 'Post Interaction',
    body: `${actorName} liked your post${postTitle ? `: "${postTitle}"` : ''}`,
    notification_type: 'post_like',
    data: {
      post_id: postId,
      actor_id: user.id,
      actor_name: actorName,
      url: `/post/${postId}`,
    },
  })
}
