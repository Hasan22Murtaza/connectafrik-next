import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { sendGroupInviteEmail } from '@/shared/services/emailService'
import { createNotification } from '@/lib/notifications/createNotification'
import { activateMembershipChat, syncGroupMemberCount } from '@/lib/groups/joinApproval'

type RouteContext = { params: Promise<{ id: string }> }

type ProfilePreview = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  country: string | null
}

async function attachProfiles(
  serviceClient: ReturnType<typeof createServiceClient>,
  rows: Array<{ user_id: string }>
) {
  const userIds = rows.map((row) => row.user_id).filter(Boolean)
  let profileMap = new Map<string, ProfilePreview>()
  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await serviceClient
      .from('profiles')
      .select('id, username, full_name, avatar_url, country')
      .in('id', userIds)

    if (profilesError) throw new Error(profilesError.message)
    profileMap = new Map((profiles || []).map((profile) => [profile.id, profile as ProfilePreview]))
  }

  return rows.map((row) => ({
    ...row,
    user: profileMap.get(row.user_id) || {
      id: row.user_id,
      username: 'Unknown',
      full_name: 'Unknown User',
      avatar_url: null,
      country: null,
    },
  }))
}

async function notifyInvitedUser(params: {
  userId: string
  groupId: string
  groupName: string
  inviterId: string
  inviterName: string
  inviterAvatar?: string | null
}) {
  const title = `Invited to ${params.groupName}`
  const message = `${params.inviterName} invited you to join ${params.groupName}.`
  const data = {
    type: 'group_invite',
    group_id: params.groupId,
    group_name: params.groupName,
    actor_id: params.inviterId,
    actor_name: params.inviterName,
    actor_avatar: params.inviterAvatar || '',
    url: `/groups/${params.groupId}`,
  }

  try {
    await createNotification({
      user_id: params.userId,
      type: 'group_invite',
      title,
      message,
      data,
    })
  } catch (error) {
    console.error('Group invite: in-app notification failed', error)
  }
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
    if (!actorMembership) return forbiddenResponse('Only group members can view pending invitations')

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200)
    const from = page * limit
    const to = from + limit - 1

    const { data: invites, error } = await serviceClient
      .from('group_memberships')
      .select('id, group_id, user_id, role, status, joined_at, updated_at')
      .eq('group_id', groupId)
      .eq('status', 'invited')
      .order('updated_at', { ascending: false })
      .range(from, to)

    if (error) return errorResponse(error.message, 400)

    const rows = invites || []
    const merged = await attachProfiles(serviceClient, rows)

    return jsonResponse({
      data: merged,
      page,
      pageSize: limit,
      hasMore: rows.length === limit,
    })
  } catch (error: unknown) {
    const message = error instanceof Error && error.message ? error.message : 'Failed to fetch pending invitations'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json().catch(() => ({}))
    const invitationMessage =
      typeof body?.message === 'string' ? body.message.trim().slice(0, 500) : ''
    const userIdsRaw: unknown[] = Array.isArray(body?.user_ids) ? body.user_ids : []
    const userIds = Array.from(
      new Set<string>(
        userIdsRaw
          .map((id: unknown) => (typeof id === 'string' ? id.trim() : ''))
          .filter((id: string) => Boolean(id))
      )
    ).filter((id: string) => id !== user.id)

    if (userIds.length === 0) {
      return errorResponse('user_ids is required and must contain at least one user id', 400)
    }

    const { data: group, error: groupError } = await serviceClient
      .from('groups')
      .select('id, name, avatar_url, banner_url, is_active')
      .eq('id', groupId)
      .maybeSingle()

    if (groupError) return errorResponse(groupError.message, 400)
    if (!group || group.is_active === false) return errorResponse('Group not found', 404)

    const { data: actorMembership, error: actorMembershipError } = await serviceClient
      .from('group_memberships')
      .select('id, role, status')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (actorMembershipError) return errorResponse(actorMembershipError.message, 400)
    if (!actorMembership) return errorResponse('Only group members can invite users', 403)

    const { data: existingRows, error: existingError } = await serviceClient
      .from('group_memberships')
      .select('id, user_id, status')
      .eq('group_id', groupId)
      .in('user_id', userIds)

    if (existingError) return errorResponse(existingError.message, 400)

    const existingByUserId = new Map((existingRows || []).map((row: any) => [row.user_id, row]))
    const alreadyActiveIds: string[] = []
    const alreadyInvitedIds: string[] = []
    const insertIds: string[] = []
    const updateToInvitedIds: string[] = []
    const approvePendingIds: string[] = []

    for (const targetUserId of userIds) {
      const existing = existingByUserId.get(targetUserId)
      if (!existing) {
        insertIds.push(targetUserId)
      } else if (existing.status === 'active') {
        alreadyActiveIds.push(targetUserId)
      } else if (existing.status === 'invited') {
        alreadyInvitedIds.push(targetUserId)
      } else if (existing.status === 'banned') {
        continue
      } else if (existing.status === 'pending') {
        approvePendingIds.push(targetUserId)
      } else {
        updateToInvitedIds.push(targetUserId)
      }
    }

    if (insertIds.length > 0) {
      const inserts = insertIds.map((targetUserId) => ({
        group_id: groupId,
        user_id: targetUserId,
        role: 'member',
        status: 'invited',
      }))
      const { error: insertError } = await serviceClient.from('group_memberships').insert(inserts)
      if (insertError) return errorResponse(insertError.message, 400)
    }

    if (updateToInvitedIds.length > 0) {
      const rowIds = updateToInvitedIds
        .map((uid) => existingByUserId.get(uid)?.id)
        .filter((id): id is string => Boolean(id))
      if (rowIds.length > 0) {
        const { error: inviteError } = await serviceClient
          .from('group_memberships')
          .update({ status: 'invited', role: 'member' })
          .in('id', rowIds)
        if (inviteError) return errorResponse(inviteError.message, 400)
      }
    }

    if (approvePendingIds.length > 0) {
      const now = new Date().toISOString()
      const rowIds = approvePendingIds
        .map((uid) => existingByUserId.get(uid)?.id)
        .filter((id): id is string => Boolean(id))
      if (rowIds.length > 0) {
        const { error: approveError } = await serviceClient
          .from('group_memberships')
          .update({ status: 'active', role: 'member', joined_at: now, updated_at: now })
          .in('id', rowIds)
        if (approveError) return errorResponse(approveError.message, 400)
      }

      for (const uid of approvePendingIds) {
        await activateMembershipChat(serviceClient, groupId, uid)
      }
    }

    const memberCount = await syncGroupMemberCount(serviceClient, groupId)
    const newlyInvitedIds = [...insertIds, ...updateToInvitedIds]

    const { data: inviterProfile } = await serviceClient
      .from('profiles')
      .select('full_name, username, avatar_url')
      .eq('id', user.id)
      .maybeSingle()

    const inviterName =
      inviterProfile?.full_name?.trim() ||
      inviterProfile?.username?.trim() ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'A ConnectAfrik member'

    const groupImageUrl = group.avatar_url || group.banner_url || null
    let emails_sent = 0

    if (newlyInvitedIds.length > 0) {
      const emailTasks = newlyInvitedIds.map(async (targetUserId) => {
        await notifyInvitedUser({
          userId: targetUserId,
          groupId,
          groupName: group.name,
          inviterId: user.id,
          inviterName,
          inviterAvatar: inviterProfile?.avatar_url,
        })

        const { data: authData, error: authErr } = await serviceClient.auth.admin.getUserById(targetUserId)
        const targetEmail = authData?.user?.email
        if (authErr || !targetEmail?.includes('@')) return false

        const sent = await sendGroupInviteEmail(targetEmail, {
          groupName: group.name,
          inviterName,
          groupImageUrl,
          invitationMessage: invitationMessage || `${inviterName} invited you to join ${group.name}.`,
          groupId,
        })
        return sent
      })

      const emailResults = await Promise.allSettled(emailTasks)
      emails_sent = emailResults.filter((result) => result.status === 'fulfilled' && result.value).length
    }

    return jsonResponse({
      added_user_ids: newlyInvitedIds,
      already_member_user_ids: alreadyActiveIds,
      already_invited_user_ids: alreadyInvitedIds,
      approved_user_ids: approvePendingIds,
      added_count: newlyInvitedIds.length,
      already_member_count: alreadyActiveIds.length,
      already_invited_count: alreadyInvitedIds.length,
      approved_count: approvePendingIds.length,
      member_count: memberCount,
      emails_sent,
      threadId: null,
      group_chat_notified: approvePendingIds.length > 0,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to invite users to group', 500)
  }
}
