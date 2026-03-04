import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    let supabase

    try {
      const auth = await getAuthenticatedUser(request)
      supabase = auth.supabase
    } catch {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200)
    const from = page * limit
    const to = from + limit - 1

    const { data: memberships, error } = await supabase
      .from('group_memberships')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('role', { ascending: false })
      .order('joined_at', { ascending: true })
      .range(from, to)

    if (error) {
      return errorResponse(error.message, 400)
    }

    const members = memberships || []
    const userIds = members.map((member: any) => member.user_id).filter(Boolean)

    let profileMap = new Map<string, any>()
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, country')
        .in('id', userIds)

      if (profilesError) {
        return errorResponse(profilesError.message, 400)
      }

      profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]))
    }

    const mergedMembers = members.map((member: any) => ({
      ...member,
      user: profileMap.get(member.user_id) || {
        id: member.user_id,
        username: 'Unknown',
        full_name: 'Unknown User',
        avatar_url: null,
        country: null,
      },
    }))

    return jsonResponse({
      data: mergedMembers,
      page,
      pageSize: limit,
      hasMore: members.length === limit,
    })
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch group members', 500)
  }
}
