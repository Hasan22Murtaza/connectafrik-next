import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 50)
    const from = page * limit
    const to = from + limit - 1

    const { data: memberships, error: membershipsError } = await supabase
      .from('group_memberships')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (membershipsError) {
      return errorResponse(membershipsError.message, 400)
    }

    if (!memberships || memberships.length === 0) {
      return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
    }

    const groupIds = memberships.map((m) => m.group_id)

    const { data: postsData, error: postsError } = await supabase
      .from('group_posts')
      .select(`
        *,
        group:groups(id, name, avatar_url),
        group_post_comments(count)
      `)
      .in('group_id', groupIds)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (postsError) {
      return errorResponse(postsError.message, 400)
    }

    if (!postsData || postsData.length === 0) {
      return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
    }

    const authorIds = [...new Set(postsData.map((p: any) => p.author_id))]
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, country')
      .in('id', authorIds)

    const profilesMap = new Map(
      (profilesData || []).map((profile: any) => [profile.id, profile])
    )

    const { data: reactionsData } = await supabase
      .from('group_post_reactions')
      .select('group_post_id, user_id, reaction_type')
      .in('group_post_id', postsData.map((p: any) => p.id))

    const reactedPostIds = new Set(
      (reactionsData || [])
        .filter((r: any) => r.user_id === user.id)
        .map((r: any) => r.group_post_id)
    )

    const reactingUserIds = [...new Set((reactionsData || []).map((r: any) => r.user_id))]
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
      const postId = reaction.group_post_id
      const reactionType = reaction.reaction_type
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
          full_name: reactingProfile.full_name,
        })
      }
    }

    const data = postsData.map((post: any) => {
      const realCommentCount =
        Array.isArray(post.group_post_comments) && post.group_post_comments.length > 0
          ? post.group_post_comments[0].count
          : post.comments_count ?? 0
      const postReactions = reactionsMap.get(post.id)
      const reactionGroupsArray = postReactions
        ? Object.values(postReactions.groups).sort((a: any, b: any) => b.count - a.count)
        : []

      return {
        ...post,
        comments_count: realCommentCount,
        author: profilesMap.get(post.author_id) ?? {
          id: post.author_id,
          username: 'Unknown',
          full_name: 'Unknown User',
          avatar_url: null,
          country: null,
        },
        isLiked: reactedPostIds.has(post.id),
        reactions: reactionGroupsArray,
        reactions_total_count: postReactions?.totalCount ?? 0,
      }
    })

    return jsonResponse({ data, page, pageSize: limit, hasMore: postsData.length === limit })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch activity', 500)
  }
}
