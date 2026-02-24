import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string; postId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { postId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')

    if (limitParam) {
      const limit = Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 50)
      const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
      const from = page * limit
      const to = from + limit - 1
      const reactionType = searchParams.get('reaction_type')

      let query = supabase
        .from('group_post_reactions')
        .select('user_id, reaction_type, created_at')
        .eq('group_post_id', postId)
        .order('created_at', { ascending: false })

      if (reactionType) {
        query = query.eq('reaction_type', reactionType)
      }

      query = query.range(from, to)

      const { data: reactionsData, error } = await query
      if (error) return errorResponse(error.message, 400)

      const rows = reactionsData || []
      const userIds = [...new Set(rows.map((r: any) => r.user_id))]

      let profileMap = new Map<string, any>()
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', userIds)
        if (profiles) {
          profileMap = new Map(profiles.map((p: any) => [p.id, p]))
        }
      }

      const items = rows
        .filter((r: any) => profileMap.has(r.user_id))
        .map((r: any) => ({
          reaction_type: r.reaction_type,
          user: profileMap.get(r.user_id),
        }))

      return jsonResponse({ data: items, page, pageSize: limit, hasMore: rows.length === limit })
    }

    const { data: reactions, error: reactionsError } = await supabase
      .from('group_post_reactions')
      .select('user_id, reaction_type')
      .eq('group_post_id', postId)

    if (reactionsError) {
      return errorResponse(reactionsError.message, 400)
    }

    const list = reactions || []
    if (list.length === 0) {
      return jsonResponse({
        data: { totalCount: 0 },
      })
    }

    const userIds = [...new Set(list.map((r: { user_id: string }) => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds)

    const profileMap = new Map((profiles || []).map((p: { id: string }) => [p.id, p]))

    const byType: Record<
      string,
      { type: string; count: number; users: unknown[]; currentUserReacted: boolean }
    > = {}
    let totalCount = 0

    for (const r of list) {
      const type = (r as { reaction_type: string }).reaction_type || 'like'
      if (!byType[type]) {
        byType[type] = {
          type,
          count: 0,
          users: [],
          currentUserReacted: false,
        }
      }
      byType[type].count += 1
      totalCount += 1
      const profile = profileMap.get(r.user_id)
      if (profile && !(byType[type].users as { id: string }[]).some((u) => u.id === profile.id)) {
        byType[type].users.push(profile)
      }
      if (r.user_id === user.id) {
        byType[type].currentUserReacted = true
      }
    }

    return jsonResponse({
      data: { ...byType, totalCount },
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to fetch reactions', 500)
  }
}
