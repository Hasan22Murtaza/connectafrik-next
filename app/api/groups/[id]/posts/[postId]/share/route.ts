import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string; postId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { postId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const supabase = createServiceClient()

    let share_type = 'internal'
    let platform: string | null = null
    try {
      const body = await request.json()
      if (body?.share_type) share_type = body.share_type
      if (body?.platform) platform = body.platform
    } catch {
      // empty body is allowed
    }

    const { error: shareError } = await supabase
      .from('group_post_shares')
      .insert({
        group_post_id: postId,
        user_id: user.id,
        share_type,
        platform,
      })

    if (shareError) return errorResponse(shareError.message, 400)

    const { data: post } = await supabase
      .from('group_posts')
      .select('shares_count')
      .eq('id', postId)
      .single()

    const nextCount = (post?.shares_count || 0) + 1

    if (post) {
      await supabase
        .from('group_posts')
        .update({ shares_count: nextCount })
        .eq('id', postId)
    }

    notifyShareAuthor(supabase, user, postId).catch(() => {})

    return jsonResponse({ success: true, shares_count: nextCount })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to share post', 500)
  }
}

async function notifyShareAuthor(supabase: any, user: any, postId: string) {
  const { data: post } = await supabase
    .from('group_posts')
    .select('author_id, content, title')
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
    },
  })
}
