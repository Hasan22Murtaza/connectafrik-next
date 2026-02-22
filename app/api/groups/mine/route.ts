import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const GROUP_SELECT = `
  *,
  creator:profiles!creator_id(id, username, full_name, avatar_url),
  memberships:group_memberships!inner(id, user_id, role, status, joined_at, updated_at)
`

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data, error } = await supabase
      .from('groups')
      .select(GROUP_SELECT)
      .eq('is_active', true)
      .eq('memberships.user_id', user.id)
      .eq('memberships.status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      return errorResponse(error.message, 400)
    }

    const groups = (data || []).map((group: any) => {
      const userMembership = group.memberships?.find(
        (m: any) => m.user_id === user.id && m.status === 'active'
      )
      return {
        ...group,
        membership: userMembership
          ? {
              id: userMembership.id,
              group_id: group.id,
              user_id: userMembership.user_id,
              role: userMembership.role,
              status: userMembership.status,
              joined_at: userMembership.joined_at,
              updated_at: userMembership.updated_at,
            }
          : undefined,
        memberships: undefined,
      }
    })

    const groupIds = groups.map((g: any) => g.id)
    if (groupIds.length > 0) {
      const { data: allMemberships } = await supabase
        .from('group_memberships')
        .select('group_id')
        .in('group_id', groupIds)
        .eq('status', 'active')

      const countMap = new Map<string, number>()
      ;(allMemberships || []).forEach((m: any) => {
        countMap.set(m.group_id, (countMap.get(m.group_id) || 0) + 1)
      })

      groups.forEach((g: any) => {
        const actualCount = countMap.get(g.id)
        if (actualCount !== undefined) {
          g.member_count = actualCount
        }
      })
    }

    return jsonResponse({ data: groups })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch your groups', 500)
  }
}
