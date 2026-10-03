import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import type { SupabaseClient } from '@supabase/supabase-js'

type RouteContext = { params: Promise<{ id: string; commentId: string }> }

type OwnedComment = {
  id: string
  post_id: string
  author_id: string
  is_deleted: boolean
}

async function loadOwnedComment(
  postId: string,
  commentId: string,
  userId: string
): Promise<
  | { error: NextResponse; comment?: undefined; serviceClient?: undefined }
  | { error?: undefined; comment: OwnedComment; serviceClient: SupabaseClient }
> {
  const serviceClient = createServiceClient()
  const { data: comment, error } = await serviceClient
    .from('comments')
    .select('id, post_id, author_id, is_deleted')
    .eq('id', commentId)
    .eq('post_id', postId)
    .maybeSingle()

  if (error) {
    return { error: errorResponse(error.message, 400) }
  }
  if (!comment || comment.is_deleted) {
    return { error: errorResponse('Comment not found', 404) }
  }
  if (comment.author_id !== userId) {
    return { error: errorResponse('You can only change your own comments', 403) }
  }

  return { comment, serviceClient }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId, commentId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const body = await request.json()
    const content = typeof body?.content === 'string' ? body.content.trim() : ''

    if (!content) {
      return errorResponse('content is required', 400)
    }

    const loaded = await loadOwnedComment(postId, commentId, user.id)
    if (loaded.error) return loaded.error

    const updatedAt = new Date().toISOString()
    const { data: updated, error: updateError } = await loaded.serviceClient
      .from('comments')
      .update({
        content,
        updated_at: updatedAt,
      })
      .eq('id', commentId)
      .eq('author_id', user.id)
      .eq('is_deleted', false)
      .select('*')
      .single()

    if (updateError || !updated) {
      return errorResponse(updateError?.message || 'Failed to update comment', 400)
    }

    return jsonResponse({ data: updated })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to update comment', 500)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId, commentId } = await context.params
    const { user } = await getAuthenticatedUser(request)

    const loaded = await loadOwnedComment(postId, commentId, user.id)
    if (loaded.error) return loaded.error

    const { data: deleted, error: updateError } = await loaded.serviceClient
      .from('comments')
      .update({
        is_deleted: true,
        content: '[deleted]',
      })
      .eq('id', commentId)
      .eq('author_id', user.id)
      .eq('is_deleted', false)
      .select('id')
      .maybeSingle()

    if (updateError) {
      return errorResponse(updateError.message, 400)
    }
    if (!deleted) {
      return errorResponse('Comment not found', 404)
    }

    const { data: post } = await loaded.serviceClient
      .from('posts')
      .select('comments_count')
      .eq('id', postId)
      .maybeSingle()

    if (post) {
      await loaded.serviceClient
        .from('posts')
        .update({ comments_count: Math.max(0, (post.comments_count || 0) - 1) })
        .eq('id', postId)
    }

    return jsonResponse({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to delete comment', 500)
  }
}
