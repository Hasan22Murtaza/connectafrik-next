import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const POST_SELECT = `
  *,
  author:profiles!posts_author_id_fkey(
    id, username, full_name, avatar_url, country
  )
`

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId } = await context.params
    let userId: string | null = null
    let supabase

    try {
      const auth = await getAuthenticatedUser(request)
      userId = auth.user.id
      supabase = auth.supabase
    } catch {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    }

    const { data: post, error } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('id', postId)
      .eq('is_deleted', false)
      .single()

    if (error || !post) {
      return errorResponse('Post not found', 404)
    }

    let isLiked = false
    if (userId) {
      const { data: likeData } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle()

      isLiked = !!likeData
    }

    return jsonResponse({ data: { ...post, isLiked } })
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch post', 500)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const allowedFields = ['title', 'content', 'category', 'media_urls', 'media_type', 'tags', 'location']
    const updates: Record<string, any> = {}
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        updates[key] = body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data: post, error } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', postId)
      .eq('author_id', user.id)
      .select(POST_SELECT)
      .single()

    if (error) {
      return errorResponse(error.message, 400)
    }

    if (!post) {
      return errorResponse('Post not found or you are not the author', 404)
    }

    return jsonResponse({ data: post })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to update post', 500)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { error } = await supabase
      .from('posts')
      .update({ is_deleted: true })
      .eq('id', postId)
      .eq('author_id', user.id)

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to delete post', 500)
  }
}
