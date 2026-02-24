import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { notificationService } from '@/shared/services/notificationService'

type RouteContext = { params: Promise<{ id: string }> }

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
