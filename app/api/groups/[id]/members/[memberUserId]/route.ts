import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  canAssignGroupRole,
  canChangeGroupMemberRole,
  canManageGroupRoles,
  canRemoveGroupMembers,
  canRestrictGroupMember,
  isAssignableGroupRole,
  isGroupAdminRole,
} from '@/lib/groups/roles'

type RouteContext = { params: Promise<{ id: string; memberUserId: string }> }

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId, memberUserId } = await context.params
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
    if (!actorMembership || !canRemoveGroupMembers(actorMembership.role)) {
      return errorResponse('Only co-admins and admins can remove members', 403)
    }

    if (memberUserId === user.id) {
      return errorResponse('You cannot remove yourself here. Use leave group.', 400)
    }

    const { data: targetMembership, error: targetError } = await serviceClient
      .from('group_memberships')
      .select('id, role, status')
      .eq('group_id', groupId)
      .eq('user_id', memberUserId)
      .maybeSingle()

    if (targetError) return errorResponse(targetError.message, 400)
    if (
      !targetMembership ||
      (targetMembership.status !== 'active' && targetMembership.status !== 'invited')
    ) {
      return errorResponse('Member not found', 404)
    }

    if (targetMembership.status === 'active' && isGroupAdminRole(targetMembership.role)) {
      return errorResponse('Cannot remove another admin', 400)
    }

    if (
      targetMembership.status === 'active' &&
      !canChangeGroupMemberRole(actorMembership.role, targetMembership.role)
    ) {
      return errorResponse('You cannot remove a member with an equal or higher role', 403)
    }

    const { error: updateError } = await serviceClient
      .from('group_memberships')
      .update({ status: targetMembership.status === 'invited' ? 'rejected' : 'left' })
      .eq('id', targetMembership.id)

    if (updateError) return errorResponse(updateError.message, 400)

    const { count: activeCount } = await serviceClient
      .from('group_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('status', 'active')

    const memberCount = activeCount ?? 0
    await serviceClient.from('groups').update({ member_count: memberCount }).eq('id', groupId)

    return jsonResponse({
      removed_user_id: memberUserId,
      member_count: memberCount,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to remove member', 500)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId, memberUserId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json().catch(() => ({}))
    const nextRole = typeof body?.role === 'string' ? body.role.trim().toLowerCase() : ''
    const hasPostingRestricted = typeof body?.posting_restricted === 'boolean'
    const postingRestricted = hasPostingRestricted ? Boolean(body.posting_restricted) : undefined

    if (!nextRole && !hasPostingRestricted) {
      return errorResponse('Provide a role or posting_restricted update', 400)
    }

    if (nextRole && !isAssignableGroupRole(nextRole)) {
      return errorResponse('role must be one of: member, manager, co_admin', 400)
    }

    const { data: actorMembership, error: actorError } = await serviceClient
      .from('group_memberships')
      .select('id, role, status')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (actorError) return errorResponse(actorError.message, 400)
    if (!actorMembership) {
      return errorResponse('Only group staff can update members', 403)
    }

    if (memberUserId === user.id) {
      return errorResponse('You cannot change your own role here', 400)
    }

    const { data: targetMembership, error: targetError } = await serviceClient
      .from('group_memberships')
      .select('id, role, status, posting_restricted')
      .eq('group_id', groupId)
      .eq('user_id', memberUserId)
      .maybeSingle()

    if (targetError) return errorResponse(targetError.message, 400)
    if (!targetMembership || targetMembership.status !== 'active') {
      return errorResponse('Member not found', 404)
    }

    if (isGroupAdminRole(targetMembership.role)) {
      return errorResponse("Cannot change another admin's role", 400)
    }

    if (!canChangeGroupMemberRole(actorMembership.role, targetMembership.role)) {
      return errorResponse('You cannot update a member with an equal or higher role', 403)
    }

    const updates: Record<string, unknown> = {}

    if (nextRole) {
      if (!canManageGroupRoles(actorMembership.role)) {
        return errorResponse('You cannot change member roles', 403)
      }
      if (!canAssignGroupRole(actorMembership.role, nextRole)) {
        return errorResponse('You cannot assign that role', 403)
      }
      updates.role = nextRole
    }

    if (hasPostingRestricted) {
      if (!canRestrictGroupMember(actorMembership.role, targetMembership.role)) {
        return errorResponse('You cannot restrict this member from posting', 403)
      }
      updates.posting_restricted = postingRestricted
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('group_memberships')
      .update(updates)
      .eq('id', targetMembership.id)
      .select()
      .maybeSingle()

    if (updateError) return errorResponse(updateError.message, 400)

    return jsonResponse({
      user_id: memberUserId,
      role: updated?.role ?? targetMembership.role,
      posting_restricted: updated?.posting_restricted ?? targetMembership.posting_restricted,
      membership: updated,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to update member role', 500)
  }
}
