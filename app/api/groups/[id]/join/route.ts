import { NextRequest } from 'next/server'
import { getAuthenticatedUser, getAccessTokenFromRequest, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { lookupGroupChatThreadId } from '@/lib/chat/chatThreadLookup'
import {
  activateMembershipChat,
  notifyAdminsOfJoinRequest,
  syncGroupMemberCount,
} from '@/lib/groups/joinApproval'

type RouteContext = { params: Promise<{ id: string }> }

type MembershipRecord = {
  id: string
  status?: string
  role?: string
  user_id?: string
  joined_at?: string
  updated_at?: string
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const accessToken = getAccessTokenFromRequest(request)
    const serviceClient = createServiceClient()

    const { data: group, error: groupError } = await serviceClient
      .from('groups')
      .select('id, name, is_public, is_active')
      .eq('id', groupId)
      .maybeSingle()

    if (groupError) return errorResponse(groupError.message, 400)
    if (!group || group.is_active === false) return errorResponse('Group not found', 404)

    const { data: existingMembership, error: existingError } = await serviceClient
      .from('group_memberships')
      .select('id, status, role, user_id, joined_at, updated_at')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingError) return errorResponse(existingError.message, 400)

    if (existingMembership?.status === 'banned') {
      return errorResponse('You are banned from this group', 403)
    }

    const returnPendingMembership = async (
      membership: MembershipRecord,
      options: { alreadyPending?: boolean; reactivate?: boolean } = {}
    ) => {
      const memberCount = await syncGroupMemberCount(serviceClient, groupId)

      if (!options.alreadyPending) {
        const { data: requesterProfile } = await serviceClient
          .from('profiles')
          .select('full_name, username, avatar_url')
          .eq('id', user.id)
          .maybeSingle()

        const requesterName =
          requesterProfile?.full_name?.trim() || requesterProfile?.username?.trim() || 'Someone'

        await notifyAdminsOfJoinRequest({
          serviceClient,
          groupId,
          groupName: group.name,
          membershipId: membership.id,
          requesterId: user.id,
          requesterName,
          requesterUsername: requesterProfile?.username || undefined,
          requesterAvatar: requesterProfile?.avatar_url || undefined,
          accessToken,
          origin: new URL(request.url).origin,
          reactivate: options.reactivate,
        })
      }

      return jsonResponse({
        data: {
          membership,
          member_count: memberCount,
          alreadyMember: false,
          alreadyPending: Boolean(options.alreadyPending),
          pending: true,
          threadId: null,
          group_chat_notified: false,
        },
      })
    }

    if (existingMembership?.status === 'active') {
      const { data: m } = await serviceClient
        .from('group_memberships')
        .select()
        .eq('id', existingMembership.id)
        .single()
      const memberCount = await syncGroupMemberCount(serviceClient, groupId)
      const threadId = (await lookupGroupChatThreadId(groupId)) ?? null
      return jsonResponse({
        data: {
          membership: m ?? existingMembership,
          member_count: memberCount,
          alreadyMember: true,
          alreadyPending: false,
          pending: false,
          threadId,
          group_chat_notified: false,
        },
      })
    }

    if (existingMembership?.status === 'pending') {
      return returnPendingMembership(existingMembership, { alreadyPending: true })
    }

    const requiresApproval = group.is_public === false
    const nextStatus = requiresApproval ? 'pending' : 'active'
    const now = new Date().toISOString()

    let membership: MembershipRecord
    if (existingMembership) {
      const updates: Record<string, unknown> = {
        status: nextStatus,
        role: existingMembership.role || 'member',
        updated_at: now,
      }
      if (nextStatus === 'active') {
        updates.joined_at = now
      }
      const { data: updated, error: updateErr } = await serviceClient
        .from('group_memberships')
        .update(updates)
        .eq('id', existingMembership.id)
        .select()
        .single()
      if (updateErr) return errorResponse(updateErr.message, 400)
      membership = updated
    } else {
      const { data: inserted, error: insertErr } = await serviceClient
        .from('group_memberships')
        .insert({
          group_id: groupId,
          user_id: user.id,
          role: 'member',
          status: nextStatus,
        })
        .select()
        .single()
      if (insertErr) {
        const isDuplicate =
          insertErr.code === '23505' || insertErr.message?.includes('unique_group_membership')
        if (!isDuplicate) return errorResponse(insertErr.message, 400)

        const { data: raced } = await serviceClient
          .from('group_memberships')
          .select()
          .eq('group_id', groupId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (raced?.status === 'active') {
          const memberCount = await syncGroupMemberCount(serviceClient, groupId)
          const threadId = (await lookupGroupChatThreadId(groupId)) ?? null
          return jsonResponse({
            data: {
              membership: raced,
              member_count: memberCount,
              alreadyMember: true,
              alreadyPending: false,
              pending: false,
              threadId,
              group_chat_notified: false,
            },
          })
        }
        if (raced?.status === 'pending') {
          return returnPendingMembership(raced, { alreadyPending: true })
        }
        return errorResponse(insertErr.message, 400)
      }
      membership = inserted
    }

    if (nextStatus === 'pending') {
      return returnPendingMembership(membership, { reactivate: Boolean(existingMembership) })
    }

    const memberCount = await syncGroupMemberCount(serviceClient, groupId)
    const threadId = await activateMembershipChat(serviceClient, groupId, user.id)
    return jsonResponse({
      data: {
        membership,
        member_count: memberCount,
        alreadyMember: false,
        alreadyPending: false,
        pending: false,
        threadId,
        group_chat_notified: Boolean(threadId),
      },
    })
  } catch (error: unknown) {
    const message = getErrorMessage(error, 'Failed to join group')
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}
