import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient, getAccessTokenFromRequest } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const COMMENT_SELECT = `
  *,
  author:profiles!reel_comments_user_id_fkey(username, full_name, avatar_url)
`

function normalizeComment<T extends Record<string, unknown>>(comment: T) {
  const userId = comment.user_id as string | undefined
  return {
    ...comment,
    // Backward compatibility for UI code that still reads author_id.
    author_id: (comment.author_id as string | undefined) ?? userId ?? null,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reelId } = await params
    const supabase = createServiceClient()

    const { data: topLevel, error: topError } = await supabase
      .from('reel_comments')
      .select(COMMENT_SELECT)
      .eq('reel_id', reelId)
      .is('parent_id', null)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })

    if (topError) return errorResponse(topError.message, 400)
    const comments = topLevel ?? []
    if (comments.length === 0) return jsonResponse({ data: [] })

    const parentIds = comments.map((c: { id: string }) => c.id)
    const { data: replies, error: repliesError } = await supabase
      .from('reel_comments')
      .select(COMMENT_SELECT)
      .eq('reel_id', reelId)
      .in('parent_id', parentIds)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })

    if (repliesError) return errorResponse(repliesError.message, 400)
    const repliesList = replies ?? []
    const repliesByParent = new Map<string, unknown[]>()
    for (const r of repliesList) {
      const pid = (r as { parent_id: string }).parent_id
      if (!repliesByParent.has(pid)) repliesByParent.set(pid, [])
      repliesByParent.get(pid)!.push(r)
    }

    const data = comments.map((c: { id: string } & Record<string, unknown>) => ({
      ...normalizeComment(c),
      replies: (repliesByParent.get(c.id) ?? []).map((r) => normalizeComment(r as Record<string, unknown>)),
    }))
    return jsonResponse({ data })
  } catch (error: unknown) {
    const err = error as { message?: string }
    return errorResponse(err.message || 'Failed to fetch comments', 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reelId } = await params
    const { user } = await getAuthenticatedUser(request)
    const supabase = createServiceClient()
    const body = await request.json()
    const { content, parent_id } = body

    if (!content) return errorResponse('content is required', 400)

    const { data: comment, error } = await supabase
      .from('reel_comments')
      .insert({
        reel_id: reelId,
        user_id: user.id,
        content,
        parent_id: parent_id ?? null,
      })
      .select(COMMENT_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    const { data: reel } = await supabase.from('reels').select('author_id, title').eq('id', reelId).maybeSingle()
    const { actorDisplayName, notifyIfAllowed, notifyMentionedUsers } = await import('@/lib/notifications')
    const actorName = actorDisplayName(user)
    if (reel?.author_id && reel.author_id !== user.id) {
      void notifyIfAllowed({
        recipientId: reel.author_id,
        actorId: user.id,
        type: 'reel_comment',
        title: 'New Comment',
        message: `${actorName} commented on your memory`,
        accessToken: getAccessTokenFromRequest(request),
        data: {
          reel_id: reelId,
          comment_id: comment.id,
          actor_name: actorName,
          url: `/memories/${reelId}`,
        },
      })
    }
    void notifyMentionedUsers({
      text: content,
      actorId: user.id,
      actorName,
      accessToken: getAccessTokenFromRequest(request),
      data: {
        reel_id: reelId,
        comment_id: comment.id,
        url: `/memories/${reelId}`,
      },
    })

    return jsonResponse({ data: normalizeComment(comment as Record<string, unknown>) }, 201)
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(err.message || 'Failed to add comment', 500)
  }
}
