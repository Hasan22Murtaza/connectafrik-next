import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const GROUP_SELECT = `
  *,
  creator:profiles!creator_id(id, username, full_name, avatar_url),
  memberships:group_memberships(id, user_id, role, status, joined_at, updated_at)
`

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
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

    const { data, error } = await supabase
      .from('groups')
      .select(GROUP_SELECT)
      .eq('id', groupId)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      return errorResponse('Group not found', 404)
    }

    const activeMemberships = (data.memberships || []).filter((m: any) => m.status === 'active')
    const actualMemberCount = activeMemberships.length

    if (data.member_count !== actualMemberCount) {
      supabase
        .from('groups')
        .update({ member_count: actualMemberCount })
        .eq('id', groupId)
        .then(({ error: syncError }) => {
          if (syncError) console.error('Failed to sync member_count:', syncError)
        })
    }

    const userMembership = userId
      ? activeMemberships.find((m: any) => m.user_id === userId)
      : undefined

    const result = {
      ...data,
      member_count: actualMemberCount,
      membership: userMembership
        ? {
            id: userMembership.id,
            group_id: groupId,
            user_id: userMembership.user_id,
            role: userMembership.role,
            status: userMembership.status,
            joined_at: userMembership.joined_at,
            updated_at: userMembership.updated_at,
          }
        : undefined,
      memberships: undefined,
    }

    return jsonResponse({ data: result })
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch group', 500)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const allowedFields = [
      'name',
      'description',
      'category',
      'goals',
      'is_public',
      'max_members',
      'location',
      'country',
      'tags',
      'rules',
      'avatar_url',
      'banner_url',
    ]
    const updates: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        updates[key] = body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data: group, error } = await supabase
      .from('groups')
      .update(updates)
      .eq('id', groupId)
      .eq('creator_id', user.id)
      .select(`*, creator:profiles!creator_id(id, username, full_name, avatar_url)`)
      .single()

    if (error) {
      return errorResponse(error.message, 400)
    }

    if (!group) {
      return errorResponse('Group not found or you are not the creator', 404)
    }

    return jsonResponse({ data: group })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to update group', 500)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: group, error: fetchError } = await supabase
      .from('groups')
      .select('id')
      .eq('id', groupId)
      .eq('creator_id', user.id)
      .single()

    if (fetchError || !group) {
      return errorResponse('Group not found or you are not the creator', 404)
    }

    const { error } = await supabase
      .from('groups')
      .update({ is_active: false })
      .eq('id', groupId)

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to delete group', 500)
  }
}
