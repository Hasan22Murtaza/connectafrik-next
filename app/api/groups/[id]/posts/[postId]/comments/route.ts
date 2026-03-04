import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string; postId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { postId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: topLevelCommentsData, error: commentsError } = await supabase
      .from('group_post_comments')
      .select('*')
      .eq('group_post_id', postId)
      .is('parent_id', null)
      .order('created_at', { ascending: true })

    if (commentsError) {
      return errorResponse(commentsError.message, 400)
    }

    const topLevelComments = topLevelCommentsData || []
    if (topLevelComments.length === 0) {
      return jsonResponse({ data: [] })
    }

    const replies: any[] = []
    let pendingParentIds = topLevelComments.map((comment: { id: string }) => comment.id)

    while (pendingParentIds.length > 0) {
      const { data: childComments, error: childError } = await supabase
        .from('group_post_comments')
        .select('*')
        .eq('group_post_id', postId)
        .in('parent_id', pendingParentIds)
        .order('created_at', { ascending: true })

      if (childError) {
        return errorResponse(childError.message, 400)
      }

      if (!childComments || childComments.length === 0) {
        break
      }

      replies.push(...childComments)
      pendingParentIds = childComments.map((comment: { id: string }) => comment.id)
    }

    const comments = [...topLevelComments, ...replies]
    const commentIds = comments.map((c: { id: string }) => c.id)
    const authorIds = [...new Set(comments.map((c: { author_id: string }) => c.author_id))]

    const { data: authorProfiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', authorIds)

    const profileMap = new Map((authorProfiles || []).map((p: { id: string }) => [p.id, p]))

    let likedCommentIds = new Set<string>()
    if (commentIds.length > 0) {
      const { data: likesData } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', user.id)
        .in('comment_id', commentIds)
      likedCommentIds = new Set((likesData || []).map((l: { comment_id: string }) => l.comment_id))
    }

    const mappedComments = comments.map((comment: any) => ({
      ...comment,
      author: profileMap.get(comment.author_id) ?? null,
      isLiked: likedCommentIds.has(comment.id),
      replies: [] as any[],
    }))

    const commentsById = new Map<string, any>()
    const topLevel: any[] = []
    for (const comment of mappedComments) {
      commentsById.set(comment.id, comment)
    }

    for (const comment of mappedComments) {
      if (comment.parent_id && commentsById.has(comment.parent_id)) {
        commentsById.get(comment.parent_id).replies.push(comment)
      } else {
        topLevel.push(comment)
      }
    }

    return jsonResponse({ data: topLevel })
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
