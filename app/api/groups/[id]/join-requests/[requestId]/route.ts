import { NextRequest } from 'next/server'
import { getAuthenticatedUser, getAccessTokenFromRequest, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { isGroupManagerRole } from '@/lib/groups/viewerMembership'
import {
  activateMembershipChat,
  notifyJoinRequestDecision,
  syncGroupMemberCount,
} from '@/lib/groups/joinApproval'

type RouteContext = { params: Promise<{ id: string; requestId: string }> }

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId, requestId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const accessToken = getAccessTokenFromRequest(request)
    const serviceClient = createServiceClient()
    const body = await request.json().catch(() => ({}))
    const status = typeof body?.status === 'string' ? body.status.trim().toLowerCase() : ''

    if (!status || !['approved', 'rejected'].includes(status)) {
      return errorResponse('status must be one of: approved, rejected', 400)
    }

    const { data: actorMembership, error: actorError } = await serviceClient
      .from('group_memberships')
      .select('id, role, status')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (actorError) return errorResponse(actorError.message, 400)
    if (!actorMembership || !isGroupManagerRole(actorMembership.role)) {
      return forbiddenResponse('Only group admins can respond to join requests')
    }

    const { data: joinRequest, error: requestError } = await serviceClient
      .from('group_memberships')
      .select('id, group_id, user_id, role, status, joined_at, updated_at')
      .eq('id', requestId)
      .eq('group_id', groupId)
      .maybeSingle()

    if (requestError) return errorResponse(requestError.message, 400)
    if (!joinRequest) return errorResponse('Join request not found', 404)
    if (joinRequest.status !== 'pending') {
      return errorResponse('Request already responded to', 400)
    }

    const now = new Date().toISOString()
    const nextStatus = status === 'approved' ? 'active' : 'rejected'
    const updates: Record<string, unknown> = {
      status: nextStatus,
      updated_at: now,
    }
    if (status === 'approved') {
      updates.joined_at = now
      updates.role = joinRequest.role || 'member'
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('group_memberships')
      .update(updates)
      .eq('id', joinRequest.id)
      .eq('status', 'pending')
      .select()
      .maybeSingle()

    if (updateError) return errorResponse(updateError.message, 400)
    if (!updated) return errorResponse('Request already responded to', 400)

    const memberCount = await syncGroupMemberCount(serviceClient, groupId)
    let threadId: string | null = null
    if (status === 'approved') {
      threadId = await activateMembershipChat(serviceClient, groupId, joinRequest.user_id)
    }

    const [{ data: group }, { data: actorProfile }] = await Promise.all([
      serviceClient.from('groups').select('name').eq('id', groupId).maybeSingle(),
      serviceClient
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', user.id)
        .maybeSingle(),
    ])

    const actorName = actorProfile?.full_name?.trim() || actorProfile?.username?.trim() || 'A group admin'
    await notifyJoinRequestDecision({
      requesterId: joinRequest.user_id,
      groupId,
      groupName: group?.name || 'the group',
      membershipId: joinRequest.id,
      approved: status === 'approved',
      actorId: user.id,
      actorName,
      actorAvatar: actorProfile?.avatar_url || undefined,
      accessToken,
      origin: new URL(request.url).origin,
    })

    return jsonResponse({
      data: {
        membership: updated,
        member_count: memberCount,
        status,
        threadId,
        group_chat_notified: Boolean(threadId),
      },
    })
  } catch (error: unknown) {
    const message = getErrorMessage(error, 'Failed to update join request')
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}
