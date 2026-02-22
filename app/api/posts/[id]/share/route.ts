import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    // Check if already shared
    const { data: existing, error: checkError } = await supabase
      .from('shares')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_id', postId)
      .maybeSingle()

    if (checkError) return errorResponse(checkError.message, 400)

    if (existing) {
      return jsonResponse({ success: false, error: 'Post already shared' }, 409)
    }

    const { error: shareError } = await supabase
      .from('shares')
      .insert({ user_id: user.id, post_id: postId })

    if (shareError) return errorResponse(shareError.message, 400)

    // Notify post author (fire-and-forget)
    notifyShareAuthor(supabase, user, postId).catch(() => {})

    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to share post', 500)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { error } = await supabase
      .from('shares')
      .delete()
      .eq('user_id', user.id)
      .eq('post_id', postId)

    if (error) return errorResponse(error.message, 400)

    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to unshare post', 500)
  }
}

async function notifyShareAuthor(supabase: any, user: any, postId: string) {
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
    title: 'Post Shared',
    body: `${actorName} shared your post${postTitle ? `: "${postTitle}"` : ''}`,
    notification_type: 'system',
    data: {
      action: 'share',
      post_id: postId,
      actor_id: user.id,
      actor_name: actorName,
      url: `/post/${postId}`,
    },
  })
}
