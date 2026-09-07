import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { canApproveGroupJoinRequests } from '@/lib/groups/roles'

type RouteContext = { params: Promise<{ id: string }> }

type ProfilePreview = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  country: string | null
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const { data: actorMembership, error: actorError } = await serviceClient
      .from('group_memberships')
      .select('id, role, status')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (actorError) return errorResponse(actorError.message, 400)
    if (!actorMembership || !canApproveGroupJoinRequests(actorMembership.role)) {
      return forbiddenResponse('Only co-admins and admins can view join requests')
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200)
    const from = page * limit
    const to = from + limit - 1

    const { data: requests, error } = await serviceClient
      .from('group_memberships')
      .select('id, group_id, user_id, role, status, joined_at, updated_at')
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .order('updated_at', { ascending: false })
      .range(from, to)

    if (error) return errorResponse(error.message, 400)

    const rows = requests || []
    const userIds = rows.map((row) => row.user_id).filter(Boolean)

    let profileMap = new Map<string, ProfilePreview>()
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await serviceClient
        .from('profiles')
        .select('id, username, full_name, avatar_url, country')
        .in('id', userIds)

      if (profilesError) return errorResponse(profilesError.message, 400)
      profileMap = new Map((profiles || []).map((profile) => [profile.id, profile as ProfilePreview]))
    }

    const merged = rows.map((row) => ({
      ...row,
      user: profileMap.get(row.user_id) || {
        id: row.user_id,
        username: 'Unknown',
        full_name: 'Unknown User',
        avatar_url: null,
        country: null,
      },
    }))

    return jsonResponse({
      data: merged,
      page,
      pageSize: limit,
      hasMore: rows.length === limit,
    })
  } catch (error: unknown) {
    const message = getErrorMessage(error, 'Failed to fetch join requests')
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}
