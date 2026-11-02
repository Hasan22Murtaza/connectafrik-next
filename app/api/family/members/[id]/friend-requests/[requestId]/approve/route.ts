import { NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { createNotification } from '@/lib/notifications/createNotification'
import {
  FamilyAuthError,
  isManagedRole,
  recordActivityEvent,
  requireParentOfMember,
} from '@/lib/family'

/**
 * Parent approves a pending friend request on behalf of a managed child/teen.
 * Does not expose message content; only updates friend_requests status.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id: memberId, requestId } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const { target } = await requireParentOfMember(supabase, user.id, memberId)

    if (!isManagedRole(target.role) || target.status !== 'active') {
      return errorResponse('Friend approval only applies to active child or teen members', 400)
    }

    const service = createServiceClient()
    const { data: row, error } = await service
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status')
      .eq('id', requestId)
      .maybeSingle()

    if (error || !row) return errorResponse('Friend request not found', 404)
    if (row.receiver_id !== target.user_id) {
      return errorResponse('Friend request does not belong to this family member', 403)
    }
    if (row.status !== 'pending') {
      return errorResponse('Request already responded to', 400)
    }

    const { data: updated, error: updateError } = await service
      .from('friend_requests')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .select('*')
      .single()

    if (updateError) return errorResponse(updateError.message, 400)

    await recordActivityEvent(service, target.user_id, 'friend_added', 1, {
      friend_request_id: requestId,
      approved_by: user.id,
    })

    try {
      await createNotification({
        user_id: target.user_id,
        type: 'family_friend_request_approved',
        title: 'Friend request approved',
        message: 'Your parent approved a friend request for your account.',
        data: {
          type: 'family_friend_request_approved',
          friend_request_id: requestId,
          family_member_id: memberId,
          url: '/friends',
        },
      })
    } catch (err) {
      console.error('Failed to notify child of friend approval:', err)
    }

    if (row.sender_id) {
      const { data: childProfile } = await service
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', target.user_id)
        .single()

      const name = childProfile?.full_name || childProfile?.username || 'Someone'
      try {
        await createNotification({
          user_id: row.sender_id,
          type: 'friend_request_accepted',
          title: 'Friend request accepted',
          message: `${name} accepted your friend request.`,
          data: {
            type: 'friend_request_accepted',
            sender_id: target.user_id,
            receiver_id: target.user_id,
            friend_request_id: requestId,
            actor_id: target.user_id,
            actor_name: name,
            actor_avatar: childProfile?.avatar_url || '',
            url: `/user/${target.user_id}`,
          },
        })
      } catch (err) {
        console.error('Failed to notify sender of parent-approved friend request:', err)
      }
    }

    return jsonResponse(updated)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to approve friend request'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    if (error instanceof FamilyAuthError) {
      return errorResponse(error.message, error.status)
    }
    return errorResponse(message, 500)
  }
}
