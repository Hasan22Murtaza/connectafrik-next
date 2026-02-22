import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string; postId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { postId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const updates: Record<string, string> = {}
    if (body.title !== undefined) updates.title = body.title
    if (body.content !== undefined) updates.content = body.content

    if (Object.keys(updates).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data: post, error } = await supabase
      .from('group_posts')
      .update(updates)
      .eq('id', postId)
      .eq('author_id', user.id)
      .select()
      .single()

    if (error) {
      return errorResponse(error.message, 400)
    }

    if (!post) {
      return errorResponse('Post not found or you are not the author', 404)
    }

    return jsonResponse({ data: post })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to update post', 500)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { postId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { error } = await supabase
      .from('group_posts')
      .update({ is_deleted: true })
      .eq('id', postId)
      .eq('author_id', user.id)

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to delete post', 500)
  }
}
