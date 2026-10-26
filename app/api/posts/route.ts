import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser, getAccessTokenFromRequest } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { POST_SELECT, formatPostsForClient } from './format-posts-response'
import { sanitizePostBackgroundId } from '@/features/social/constants/postBackgrounds'
import { sanitizePostFeeling } from '@/features/social/utils/postFeeling'
import {
  replacePostTaggedUsers,
  sanitizeTaggedUserIds,
} from '@/features/social/utils/postTaggedUsers'
import {
  normalizePostVisibility,
  postVisibilityFromProfileDefault,
} from '@/shared/utils/visibilityUtils'
import type { PostVisibility } from '@/shared/types'

const PAGE_SIZE = 10

const POST_SELECT_SINGLE = `
  *,
  author:profiles!posts_author_id_fkey(
    id, username, full_name, avatar_url, country
  )
`

export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || String(PAGE_SIZE), 10) || PAGE_SIZE, 1), PAGE_SIZE)
    const category = searchParams.get('category') || undefined
    const subcategory = searchParams.get('subcategory') || undefined

    let query = supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    if ((category === 'culture' || category === 'politics') && subcategory) {
      query = query.contains('tags', [subcategory])
    }

    const from = page * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: postsData, error: postsError } = await query

    if (postsError) {
      return errorResponse(postsError.message, 400)
    }

    const posts = postsData || []

    const result = await formatPostsForClient(supabase, userId, posts)

    return jsonResponse({
      data: result,
      page,
      pageSize: limit,
      hasMore: posts.length === limit,
    })
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch posts', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const {
      content,
      category,
      media_type,
      media_urls,
      tags,
      location,
      background_id,
      visibility,
      feeling,
      tagged_user_ids,
    } = body

    const urls = Array.isArray(media_urls) ? media_urls : []
    const mt = (media_type || (urls.length > 0 ? 'image' : 'none')) as string
    const trimmedContent = typeof content === 'string' ? content.trim() : ''
    const hasMediaPayload = urls.length > 0 || mt === 'image' || mt === 'video'
    const hasLocation =
      typeof location === 'string' && location.trim().length > 0
    const resolvedFeeling = sanitizePostFeeling(feeling)
    const resolvedTaggedIds = await sanitizeTaggedUserIds(supabase, user.id, tagged_user_ids)
    if (!hasMediaPayload && !hasLocation && !resolvedFeeling && trimmedContent.length < 10) {
      return errorResponse(
        'Add at least 10 characters of text, attach media, add a location, or choose a feeling',
        400
      )
    }

    const isTextOnly = urls.length === 0 && mt === 'none'
    const resolvedBackgroundId = isTextOnly ? sanitizePostBackgroundId(background_id) : null

    let resolvedVisibility: PostVisibility = normalizePostVisibility(visibility)
    if (visibility == null || visibility === '') {
      const { data: authorProfile } = await supabase
        .from('profiles')
        .select('post_visibility')
        .eq('id', user.id)
        .maybeSingle()
      resolvedVisibility = postVisibilityFromProfileDefault(authorProfile?.post_visibility)
    }

    const { data: post, error: insertError } = await supabase
      .from('posts')
      .insert({
        content: trimmedContent,
        category: category || 'general',
        media_type: mt,
        media_urls: urls,
        tags: tags || [],
        location: location || null,
        background_id: resolvedBackgroundId,
        visibility: resolvedVisibility,
        feeling: resolvedFeeling,
        author_id: user.id,
      })
      .select(POST_SELECT_SINGLE)
      .single()

    if (insertError) {
      return errorResponse(insertError.message, 400)
    }

    let taggedUsers: {
      id: string
      username: string
      full_name: string
      avatar_url: string | null
    }[] = []
    if (resolvedTaggedIds.length > 0) {
      try {
        await replacePostTaggedUsers(supabase, post.id, resolvedTaggedIds)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', resolvedTaggedIds)
        taggedUsers = (profiles || []).map((p) => ({
          id: p.id,
          username: p.username,
          full_name: p.full_name,
          avatar_url: p.avatar_url ?? null,
        }))
      } catch (tagErr: any) {
        console.error('Failed to save post tagged users:', tagErr?.message || tagErr)
      }
    }

    if (resolvedVisibility !== 'only_me') {
      notifyFollowersAndFriends(user, post, getAccessTokenFromRequest(request)).catch(() => {})
    }

    return jsonResponse({
      data: {
        id: post.id,
        author_id: post.author_id,
        content: post.content,
        category: post.category,
        tags: post.tags,
        visibility: post.visibility ?? resolvedVisibility,
        background_id: post.background_id ?? null,
        feeling: post.feeling ?? resolvedFeeling,
        tagged_users: taggedUsers,
        media_urls: post.media_urls,
        media_type: post.media_type,
        likes_count: post.likes_count ?? 0,
        comments_count: post.comments_count ?? 0,
        shares_count: post.shares_count ?? 0,
        views_count: post.views_count ?? 0,
        location: post.location,
        created_at: post.created_at,
        author: post.author ? {
          id: post.author.id,
          username: post.author.username,
          full_name: post.author.full_name,
          avatar_url: post.author.avatar_url,
          country: post.author.country,
        } : null,
        isLiked: false,
        isShare: false,
      },
    }, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to create post', 500)
  }
}

async function notifyFollowersAndFriends(
  user: { id: string; user_metadata?: Record<string, unknown>; email?: string | null },
  post: { id: string; content?: string | null },
  accessToken: string | null,
) {
  try {
    const { actorDisplayName, notifyFollowersOfContent, notifyMentionedUsers } = await import(
      '@/lib/notifications'
    )
    const authorName = actorDisplayName(user, user.email?.split('@')[0] || 'Someone')
    const postTitle = post.content?.substring(0, 80) || 'a new post'
    const data = {
      type: 'post_create' as const,
      post_id: post.id,
      author_id: user.id,
      author_name: authorName,
      url: `/post/${post.id}`,
    }

    await notifyFollowersOfContent({
      authorId: user.id,
      authorName,
      type: 'post_create',
      title: 'New Post',
      message: `${authorName} shared a new post: "${postTitle}"`,
      data,
      accessToken,
      postPreview: postTitle,
      postId: post.id,
    })

    await notifyMentionedUsers({
      text: post.content,
      actorId: user.id,
      actorName: authorName,
      accessToken,
      data: {
        post_id: post.id,
        url: `/post/${post.id}`,
      },
    })
  } catch (error) {
    console.error('Post create notification failed:', error)
  }
}
