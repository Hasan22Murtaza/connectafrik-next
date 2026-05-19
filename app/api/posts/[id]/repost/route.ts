import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { formatPostsForClient } from '../../format-posts-response'

const POST_SELECT_SINGLE = `
  *,
  author:profiles!posts_author_id_fkey(
    id, username, full_name, avatar_url, country
  )
`

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: sourcePostId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    let caption = ''
    try {
      const body = await request.json()
      if (body && typeof body.content === 'string') {
        caption = body.content.trim()
      }
    } catch {
      /* empty body is fine */
    }

    const { data: sourcePost, error: sourceErr } = await supabase
      .from('posts')
      .select('id, author_id, category, is_deleted, shares_count, repost_of_id')
      .eq('id', sourcePostId)
      .maybeSingle()

    if (sourceErr || !sourcePost || sourcePost.is_deleted) {
      return errorResponse('Post not found', 404)
    }

    const { data: existingRepost } = await supabase
      .from('posts')
      .select('id')
      .eq('author_id', user.id)
      .eq('repost_of_id', sourcePostId)
      .eq('is_deleted', false)
      .maybeSingle()

    if (existingRepost) {
      return errorResponse('You already reposted this post', 409)
    }

    const { data: repostRow, error: insertErr } = await supabase
      .from('posts')
      .insert({
        author_id: user.id,
        repost_of_id: sourcePostId,
        content: caption,
        category: sourcePost.category || 'general',
        media_type: 'none',
        media_urls: [],
        tags: [],
        location: null,
        background_id: null,
      })
      .select(POST_SELECT_SINGLE)
      .single()

    if (insertErr) {
      if (insertErr.code === '23505') {
        return errorResponse('You already reposted this post', 409)
      }
      return errorResponse(insertErr.message, 400)
    }

    const nextShares = (sourcePost.shares_count ?? 0) + 1
    await supabase
      .from('posts')
      .update({ shares_count: nextShares })
      .eq('id', sourcePostId)

    if (sourcePost.author_id !== user.id) {
      notifyRepostAuthor(supabase, user, sourcePostId, sourcePost.author_id).catch(() => {})
    }

    const [formatted] = await formatPostsForClient(supabase, user.id, [repostRow])

    return jsonResponse({ repost: formatted })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to repost', 500)
  }
}

async function notifyRepostAuthor(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>['supabase'],
  user: { id: string; user_metadata?: Record<string, unknown>; email?: string | null },
  sourcePostId: string,
  authorId: string
) {
  const { data: post } = await supabase
    .from('posts')
    .select('content')
    .eq('id', sourcePostId)
    .single()

  const { sendNotification } = await import('@/shared/services/notificationService')
  const actorName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    user.email ||
    'Someone'
  const preview = post?.content?.substring(0, 50) || 'your post'

  await sendNotification({
    user_id: authorId,
    title: 'Post Reposted',
    body: `${actorName} reposted ${preview ? `"${preview}"` : 'your post'}`,
    notification_type: 'system',
    data: {
      action: 'repost',
      post_id: sourcePostId,
      actor_id: user.id,
      actor_name: actorName,
      url: `/post/${sourcePostId}`,
    },
  })
}
