import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

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
    if (!actorMembership || actorMembership.role !== 'admin') {
      return errorResponse('Only admins can remove members', 403)
    }

    if (memberUserId === user.id) {
      return errorResponse('Admins cannot remove themselves here. Use leave group.', 400)
    }

    const { data: targetMembership, error: targetError } = await serviceClient
      .from('group_memberships')
      .select('id, role, status')
      .eq('group_id', groupId)
      .eq('user_id', memberUserId)
      .maybeSingle()

    if (targetError) return errorResponse(targetError.message, 400)
    if (!targetMembership || targetMembership.status !== 'active') {
      return errorResponse('Member not found', 404)
    }

    if (targetMembership.role === 'admin') {
      return errorResponse('Cannot remove another admin', 400)
    }

    const { error: updateError } = await serviceClient
      .from('group_memberships')
      .update({ status: 'left' })
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

