import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string; postId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { postId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

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
      if (profile && !byType[type].users.some((u: { id: string }) => u.id === profile.id)) {
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
