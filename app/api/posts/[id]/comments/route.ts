import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { notificationService } from '@/shared/services/notificationService'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId } = await context.params
    const serviceClient = createServiceClient()
    const searchParams = request.nextUrl.searchParams
    const rawLimit = Number(searchParams.get('limit') || '20')
    const rawPage = Number(searchParams.get('page') || '1')

    if (!Number.isFinite(rawLimit) || rawLimit < 1) {
      return errorResponse('limit must be a positive number', 400)
    }
    if (!Number.isFinite(rawPage) || rawPage < 1) {
      return errorResponse('page must be a positive number', 400)
    }

    const limit = Math.min(Math.floor(rawLimit), 100)
    const page = Math.floor(rawPage)
    const from = (page - 1) * limit
    const to = from + limit - 1

    let userId: string | null = null
    try {
      const { user } = await getAuthenticatedUser(request)
      userId = user.id
    } catch {
      userId = null
    }

    const { data: topLevelCommentsData, error: commentsError, count: topLevelCount } = await serviceClient
      .from('comments')
      .select(`
        *,
        author:profiles!comments_author_id_fkey(
          id,
          username,
          full_name,
          avatar_url,
          country,
          is_verified
        )
      `, { count: 'exact' })
      .eq('post_id', postId)
      .eq('is_deleted', false)
      .is('parent_id', null)
      .order('created_at', { ascending: true })
      .range(from, to)

    if (commentsError) {
      return errorResponse(commentsError.message, 400)
    }

    const topLevelComments = topLevelCommentsData || []
    const total = topLevelCount ?? 0

    if (topLevelComments.length === 0) {
      return jsonResponse({
        data: [],
        page,
        pageSize: limit,
        hasMore: false,
      })
    }

    const replies: any[] = []
    let pendingParentIds = topLevelComments.map((comment: { id: string }) => comment.id)

    while (pendingParentIds.length > 0) {
      const { data: childComments, error: childError } = await serviceClient
        .from('comments')
        .select(`
          *,
          author:profiles!comments_author_id_fkey(
            id,
            username,
            full_name,
            avatar_url,
            country,
            is_verified
          )
        `)
        .eq('post_id', postId)
        .eq('is_deleted', false)
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
    const commentIds = comments.map((comment: { id: string }) => comment.id)

    let likedCommentIds = new Set<string>()
    if (userId && commentIds.length > 0) {
      const { data: likesData } = await serviceClient
        .from('likes')
        .select('comment_id')
        .eq('user_id', userId)
        .in('comment_id', commentIds)

      likedCommentIds = new Set((likesData || []).map((like: { comment_id: string }) => like.comment_id))
    }

    const { data: reactionsData } = await serviceClient
      .from('comment_reactions')
      .select('comment_id, emoji, user_id')
      .in('comment_id', commentIds)

    const reactionsByComment = new Map<string, Map<string, { count: number; user_reacted: boolean }>>()
    for (const reaction of reactionsData || []) {
      if (!reactionsByComment.has(reaction.comment_id)) {
        reactionsByComment.set(reaction.comment_id, new Map())
      }

      const reactionMap = reactionsByComment.get(reaction.comment_id)!
      const existing = reactionMap.get(reaction.emoji) || { count: 0, user_reacted: false }

      reactionMap.set(reaction.emoji, {
        count: existing.count + 1,
        user_reacted: existing.user_reacted || (!!userId && reaction.user_id === userId),
      })
    }

    const mappedComments = comments.map((comment: any) => {
      const reactionMap = reactionsByComment.get(comment.id) || new Map()
      const reactions = Array.from(reactionMap.entries())
        .map(([emoji, details]) => ({
          emoji,
          count: details.count,
          user_reacted: details.user_reacted,
        }))
        .sort((a, b) => b.count - a.count)

      return {
        ...comment,
        isLiked: likedCommentIds.has(comment.id),
        reactions,
        replies: [] as any[],
      }
    })

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

    const totalPages = Math.ceil(total / limit)
    const hasNext = page < totalPages
    return jsonResponse({
      data: topLevel,
      page,
      pageSize: limit,
      hasMore: hasNext,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    return errorResponse(err.message || 'Failed to fetch post comments', 500)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json()

    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    const parentId = typeof body?.parent_id === 'string' && body.parent_id.trim().length > 0
      ? body.parent_id.trim()
      : null

    if (!content) {
      return errorResponse('content is required', 400)
    }

    const { data: postData, error: postError } = await serviceClient
      .from('posts')
      .select('id, author_id, title, content, comments_count')
      .eq('id', postId)
      .single()

    if (postError) {
      return errorResponse(postError.message, 400)
    }
    if (!postData) {
      return errorResponse('Post not found', 404)
    }

    const { data: comment, error: insertError } = await serviceClient
      .from('comments')
      .insert({
        post_id: postId,
        author_id: user.id,
        content,
        parent_id: parentId,
      })
      .select('*')
      .single()

    if (insertError || !comment) {
      return errorResponse(insertError?.message || 'Failed to create comment', 400)
    }

    // Keep post comment counter in sync (best-effort)
    await serviceClient
      .from('posts')
      .update({ comments_count: (postData.comments_count || 0) + 1 })
      .eq('id', postId)

    const { data: authorProfile } = await serviceClient
      .from('profiles')
      .select('id, username, full_name, avatar_url, country, is_verified')
      .eq('id', user.id)
      .single()

    // Notify post author when another user comments
    if (postData.author_id && postData.author_id !== user.id) {
      const actorName = user.user_metadata?.full_name || user.email || 'Someone'
      const postTitle = postData.title || postData.content?.substring(0, 50) || 'your post'

      await notificationService.sendNotification({
        user_id: postData.author_id,
        title: 'New Comment',
        body: `${actorName} commented on your post${postTitle ? `: "${postTitle}"` : ''}`,
        notification_type: 'comment',
        data: {
          action: 'comment',
          post_id: postId,
          actor_id: user.id,
          actor_name: actorName,
          url: `/post/${postId}`,
        },
      })
    }

    return jsonResponse({
      data: {
        ...comment,
        author: authorProfile || null,
      },
    }, 201)
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to create post comment', 500)
  }
}
