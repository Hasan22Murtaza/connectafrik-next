import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10) || 10, 1), 50)
    const from = page * limit
    const to = from + limit - 1

    const { data: postsData, error: postsError } = await supabase
      .from('group_posts')
      .select('*, group_post_comments(count)')
      .eq('group_id', groupId)
      .eq('is_deleted', false)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (postsError) {
      return errorResponse(postsError.message, 400)
    }

    const posts = postsData || []
    if (posts.length === 0) {
      return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
    }

    const authorIds = [...new Set(posts.map((p: { author_id: string }) => p.author_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, country')
      .in('id', authorIds)

    const profileMap = new Map((profiles || []).map((p: { id: string }) => [p.id, p]))

    const { data: reactionsData } = await supabase
      .from('group_post_reactions')
      .select('group_post_id, user_id, reaction_type')
      .in('group_post_id', posts.map((p: { id: string }) => p.id))

    const likedPostIds = new Set(
      (reactionsData || [])
        .filter((r: { user_id: string }) => r.user_id === user.id)
        .map((r: { group_post_id: string }) => r.group_post_id)
    )

    const reactingUserIds = [...new Set((reactionsData || []).map((r: { user_id: string }) => r.user_id))]
    const { data: reactingProfilesData } = reactingUserIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', reactingUserIds)
      : { data: [] as any[] }
    const reactingProfilesMap = new Map(
      (reactingProfilesData || []).map((profile: any) => [profile.id, profile])
    )

    const reactionsMap = new Map<string, { groups: Record<string, any>; totalCount: number }>()
    for (const reaction of reactionsData || []) {
      const postId = reaction.group_post_id as string
      const reactionType = reaction.reaction_type as string
      if (!reactionsMap.has(postId)) {
        reactionsMap.set(postId, { groups: {}, totalCount: 0 })
      }
      const entry = reactionsMap.get(postId)!
      if (!entry.groups[reactionType]) {
        entry.groups[reactionType] = {
          type: reactionType,
          count: 0,
          users: [],
          currentUserReacted: false,
        }
      }
      entry.groups[reactionType].count += 1
      entry.totalCount += 1
      if (reaction.user_id === user.id) {
        entry.groups[reactionType].currentUserReacted = true
      }
      const reactingProfile = reactingProfilesMap.get(reaction.user_id)
      if (reactingProfile) {
        entry.groups[reactionType].users.push({
          id: reactingProfile.id,
          username: reactingProfile.username || '',
          full_name: reactingProfile.full_name || 'Unknown',
          avatar_url: reactingProfile.avatar_url || null,
        })
      }
    }

    const result = posts.map((post: {
      id: string
      author_id: string
      group_post_comments?: { count: number }[]
      [key: string]: unknown
    }) => {
      const realCommentCount =
        Array.isArray(post.group_post_comments) && post.group_post_comments.length > 0
          ? post.group_post_comments[0].count
          : (post.comments_count ?? 0)
      const { group_post_comments: _, ...rest } = post
      const postReactions = reactionsMap.get(post.id)
      const reactionGroupsArray = postReactions
        ? Object.values(postReactions.groups).sort((a: any, b: any) => b.count - a.count)
        : []
      return {
        ...rest,
        author: profileMap.get(post.author_id) ?? null,
        comments_count: realCommentCount,
        isLiked: likedPostIds.has(post.id),
        reactions: reactionGroupsArray,
        reactions_total_count: postReactions?.totalCount ?? 0,
      }
    })

    return jsonResponse({
      data: result,
      page,
      pageSize: limit,
      hasMore: posts.length === limit,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to fetch group posts', 500)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const { title, content, post_type, media_urls } = body

    if (!content) {
      return errorResponse('Content is required', 400)
    }

    const { data: post, error: insertError } = await supabase
      .from('group_posts')
      .insert({
        group_id: groupId,
        author_id: user.id,
        title: title ?? '',
        content,
        post_type: post_type ?? 'text',
        media_urls: media_urls ?? [],
        likes_count: 0,
        comments_count: 0,
        is_pinned: false,
        is_deleted: false,
      })
      .select()
      .single()

    if (insertError) {
      return errorResponse(insertError.message, 400)
    }

    const { data: authorProfile } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, country')
      .eq('id', user.id)
      .single()

    return jsonResponse(
      { data: { ...post, author: authorProfile ?? null } },
      201
    )
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to create group post', 500)
  }
}
