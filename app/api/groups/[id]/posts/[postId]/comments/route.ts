import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string; postId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { postId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: commentsData, error: commentsError } = await supabase
      .from('group_post_comments')
      .select('*')
      .eq('group_post_id', postId)
      .is('parent_id', null)
      .order('created_at', { ascending: true })

    if (commentsError) {
      return errorResponse(commentsError.message, 400)
    }

    const comments = commentsData || []
    if (comments.length === 0) {
      return jsonResponse({ data: [] })
    }

    const commentIds = comments.map((c: { id: string }) => c.id)
    const authorIds = [...new Set(comments.map((c: { author_id: string }) => c.author_id))]

    const { data: authorProfiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', authorIds)

    const profileMap = new Map((authorProfiles || []).map((p: { id: string }) => [p.id, p]))

    const { data: repliesData } = await supabase
      .from('group_post_comments')
      .select('*')
      .in('parent_id', commentIds)
      .order('created_at', { ascending: true })

    const replies = repliesData || []
    const replyAuthorIds = [...new Set(replies.map((r: { author_id: string }) => r.author_id))]
    let replyProfileMap = new Map<string, { id: string; username?: string; full_name?: string; avatar_url?: string }>()
    if (replyAuthorIds.length > 0) {
      const { data: replyProfiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', replyAuthorIds)
      replyProfileMap = new Map((replyProfiles || []).map((p: { id: string }) => [p.id, p]))
    }

    const allCommentIds = [...commentIds, ...replies.map((r: { id: string }) => r.id)]
    let likedCommentIds = new Set<string>()
    if (allCommentIds.length > 0) {
      const { data: likesData } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', user.id)
        .in('comment_id', allCommentIds)
      likedCommentIds = new Set((likesData || []).map((l: { comment_id: string }) => l.comment_id))
    }

    const repliesByParent = new Map<string, unknown[]>()
    for (const r of replies) {
      const parentId = (r as { parent_id: string }).parent_id
      if (!repliesByParent.has(parentId)) repliesByParent.set(parentId, [])
      repliesByParent.get(parentId)!.push({
        ...r,
        author: replyProfileMap.get(r.author_id) ?? null,
        isLiked: likedCommentIds.has(r.id),
      })
    }

    const result = comments.map((c: { id: string; author_id: string }) => ({
      ...c,
      author: profileMap.get(c.author_id) ?? null,
      replies: repliesByParent.get(c.id) ?? [],
      isLiked: likedCommentIds.has(c.id),
    }))

    return jsonResponse({ data: result })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to fetch comments', 500)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { postId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const { content, parent_id } = body

    if (!content) {
      return errorResponse('Content is required', 400)
    }

    const { data: comment, error: insertError } = await supabase
      .from('group_post_comments')
      .insert({
        group_post_id: postId,
        author_id: user.id,
        content,
        parent_id: parent_id ?? null,
      })
      .select()
      .single()

    if (insertError) {
      return errorResponse(insertError.message, 400)
    }

    try {
      const { data: post } = await supabase
        .from('group_posts')
        .select('comments_count')
        .eq('id', postId)
        .single()
      await supabase
        .from('group_posts')
        .update({ comments_count: (post?.comments_count ?? 0) + 1 })
        .eq('id', postId)
    } catch {
      // best-effort increment
    }

    const { data: authorProfile } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .eq('id', user.id)
      .single()

    return jsonResponse(
      { data: { ...comment, author: authorProfile ?? null } },
      201
    )
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to add comment', 500)
  }
}
