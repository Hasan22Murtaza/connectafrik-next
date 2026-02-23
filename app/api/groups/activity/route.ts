import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 50) : 20

    const { data: memberships, error: membershipsError } = await supabase
      .from('group_memberships')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (membershipsError) {
      return errorResponse(membershipsError.message, 400)
    }

    if (!memberships || memberships.length === 0) {
      return jsonResponse({ data: [] })
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
      .limit(limit)

    if (postsError) {
      return errorResponse(postsError.message, 400)
    }

    if (!postsData || postsData.length === 0) {
      return jsonResponse({ data: [] })
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
      .select('group_post_id')
      .eq('user_id', user.id)
      .in('group_post_id', postsData.map((p: any) => p.id))

    const reactedPostIds = new Set((reactionsData || []).map((r: any) => r.group_post_id))

    const data = postsData.map((post: any) => {
      const realCommentCount =
        Array.isArray(post.group_post_comments) && post.group_post_comments.length > 0
          ? post.group_post_comments[0].count
          : post.comments_count ?? 0
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
      }
    })

    return jsonResponse({ data })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch activity', 500)
  }
}
