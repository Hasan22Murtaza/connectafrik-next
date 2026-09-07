import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { lookupGroupChatThreadId } from '@/lib/chat/chatThreadLookup'
import { canApproveGroupJoinRequests, canEditGroupSettings, canViewGroupComplaints } from '@/lib/groups/roles'
import { countPendingJoinRequests, pickViewerMembership } from '@/lib/groups/viewerMembership'

const GROUP_SELECT = `
  *,
  creator:profiles!creator_id(id, username, full_name, avatar_url),
  memberships:group_memberships(id, user_id, role, status, joined_at, updated_at, posting_restricted)
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

    let ownMembership = null
    if (userId) {
      const { data: ownRow } = await supabase
        .from('group_memberships')
        .select('id, user_id, role, status, joined_at, updated_at, posting_restricted')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle()
      ownMembership = ownRow
    }
    const viewerMembership = pickViewerMembership(
      groupId,
      ownMembership ? [ownMembership] : data.memberships || [],
      userId
    )
    const canManageJoinRequests =
      viewerMembership?.status === 'active' && canApproveGroupJoinRequests(viewerMembership.role)

    let pendingJoinCount: number | undefined
    let pendingReportCount: number | undefined
    if (canManageJoinRequests) {
      try {
        const serviceClient = createServiceClient()
        const { count } = await serviceClient
          .from('group_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', groupId)
          .eq('status', 'pending')
        pendingJoinCount = count ?? 0
      } catch {
        pendingJoinCount = countPendingJoinRequests(data.memberships || [])
      }
    }

    if (viewerMembership?.status === 'active' && canViewGroupComplaints(viewerMembership.role)) {
      try {
        const serviceClient = createServiceClient()
        const { count } = await serviceClient
          .from('group_post_reports')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', groupId)
          .eq('status', 'pending')
        pendingReportCount = count ?? 0
      } catch {
        pendingReportCount = 0
      }
    }

    const threadId = (await lookupGroupChatThreadId(groupId)) ?? null
    const result = {
      ...data,
      member_count: actualMemberCount,
      membership: viewerMembership,
      pending_join_count: pendingJoinCount,
      pending_report_count: pendingReportCount,
      memberships: undefined,
      threadId,
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
      'require_post_approval',
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

    const { data: actorMembership } = await supabase
      .from('group_memberships')
      .select('role, status')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    const { data: existingGroup } = await supabase
      .from('groups')
      .select('id, creator_id')
      .eq('id', groupId)
      .maybeSingle()

    if (!existingGroup) {
      return errorResponse('Group not found', 404)
    }

    const isCreator = existingGroup.creator_id === user.id
    if (!isCreator && !canEditGroupSettings(actorMembership?.role)) {
      return errorResponse('Only group admins can update this group', 403)
    }

    const { data: group, error } = await supabase
      .from('groups')
      .update(updates)
      .eq('id', groupId)
      .select(`*, creator:profiles!creator_id(id, username, full_name, avatar_url)`)
      .single()

    if (error) {
      return errorResponse(error.message, 400)
    }

    if (!group) {
      return errorResponse('Group not found', 404)
    }

    const threadId = (await lookupGroupChatThreadId(groupId)) ?? null
    return jsonResponse({ data: { ...group, threadId } })
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
