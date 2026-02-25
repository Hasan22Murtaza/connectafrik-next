import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const POST_SELECT = `
  *,
  author:profiles!posts_author_id_fkey(
    id, username, full_name, avatar_url, country
  ),
  comments(count)
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
      const { data: reactionData } = await supabase
        .from('post_reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle()

      isLiked = !!reactionData
    }

    const reactionsByType: Record<string, { type: string; count: number; users: any[]; currentUserReacted: boolean }> = {}
    let reactionsTotalCount = 0

    const { data: reactionsData } = await supabase
      .from('post_reactions')
      .select('user_id, reaction_type')
      .eq('post_id', postId)

    if (reactionsData && reactionsData.length > 0) {
      const reactingUserIds = [...new Set(reactionsData.map((r: any) => r.user_id))]
      let profileMap = new Map<string, any>()
      if (reactingUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', reactingUserIds)
        if (profiles) {
          profileMap = new Map(profiles.map((p: any) => [p.id, p]))
        }
      }

      for (const r of reactionsData) {
        if (!reactionsByType[r.reaction_type]) {
          reactionsByType[r.reaction_type] = { type: r.reaction_type, count: 0, users: [], currentUserReacted: false }
        }
        const group = reactionsByType[r.reaction_type]
        group.count++
        reactionsTotalCount++
        const profile = profileMap.get(r.user_id)
        if (profile && !group.users.find((u: any) => u.id === profile.id)) {
          group.users.push(profile)
        }
        if (userId && r.user_id === userId) {
          group.currentUserReacted = true
        }
      }
    }

    const reactions = Object.values(reactionsByType).sort((a, b) => b.count - a.count)

    // Increment view count (non-blocking, skip for post author)
    if (userId && userId !== post.author_id) {
      const svc = createServiceClient()
      svc.from('posts')
        .update({ views_count: (post.views_count || 0) + 1 })
        .eq('id', postId)
        .then(({ error: viewErr }) => {
          if (viewErr) console.error('Failed to increment views:', viewErr.message)
        })
    }

    return jsonResponse({
      data: {
        id: post.id,
        author_id: post.author_id,
        title: post.title,
        content: post.content,
        category: post.category,
        tags: post.tags,
        media_urls: post.media_urls,
        media_type: post.media_type,
        likes_count: post.likes_count,
        comments_count: Array.isArray(post.comments) && post.comments.length > 0
          ? post.comments[0].count
          : post.comments_count,
        shares_count: post.shares_count,
        views_count: post.views_count + (userId && userId !== post.author_id ? 1 : 0),
        location: post.location,
        created_at: post.created_at,
        author: post.author ? {
          id: post.author.id,
          username: post.author.username,
          full_name: post.author.full_name,
          avatar_url: post.author.avatar_url,
          country: post.author.country,
        } : null,
        isLiked,
        reactions,
        reactions_total_count: reactionsTotalCount,
      },
    })
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

    return jsonResponse({
      data: {
        id: post.id,
        author_id: post.author_id,
        title: post.title,
        content: post.content,
        category: post.category,
        tags: post.tags,
        media_urls: post.media_urls,
        media_type: post.media_type,
        likes_count: post.likes_count,
        comments_count: Array.isArray(post.comments) && post.comments.length > 0
          ? post.comments[0].count
          : post.comments_count,
        shares_count: post.shares_count,
        views_count: post.views_count,
        location: post.location,
        created_at: post.created_at,
        author: post.author ? {
          id: post.author.id,
          username: post.author.username,
          full_name: post.author.full_name,
          avatar_url: post.author.avatar_url,
          country: post.author.country,
        } : null,
      },
    })
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
