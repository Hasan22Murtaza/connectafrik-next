import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { lookupGroupChatThreadId } from '@/lib/chatThreadLookup'
import {
  ensureChatParticipantsForThread,
  insertGroupMembershipSystemMessage,
} from '@/lib/groupChatSystemMessages'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json().catch(() => ({}))
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
      .select('id, is_active')
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
    const reactivatedIds: string[] = []
    const insertIds: string[] = []

    for (const targetUserId of userIds) {
      const existing = existingByUserId.get(targetUserId)
      if (!existing) {
        insertIds.push(targetUserId)
      } else if (existing.status === 'active') {
        alreadyActiveIds.push(targetUserId)
      } else {
        reactivatedIds.push(targetUserId)
      }
    }

    if (insertIds.length > 0) {
      const inserts = insertIds.map((targetUserId) => ({
        group_id: groupId,
        user_id: targetUserId,
        role: 'member',
        status: 'active',
      }))
      const { error: insertError } = await serviceClient.from('group_memberships').insert(inserts)
      if (insertError) return errorResponse(insertError.message, 400)
    }

    if (reactivatedIds.length > 0) {
      const rowIds = reactivatedIds
        .map((uid) => existingByUserId.get(uid)?.id)
        .filter((id): id is string => Boolean(id))
      if (rowIds.length > 0) {
        const { error: reactivateError } = await serviceClient
          .from('group_memberships')
          .update({ status: 'active' })
          .in('id', rowIds)
        if (reactivateError) return errorResponse(reactivateError.message, 400)
      }
    }

    const { count: activeCount } = await serviceClient
      .from('group_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('status', 'active')

    const memberCount = activeCount ?? 0
    await serviceClient.from('groups').update({ member_count: memberCount }).eq('id', groupId)

    const threadId = (await lookupGroupChatThreadId(groupId)) ?? null
    const newlyAddedIds = [...insertIds, ...reactivatedIds]

    if (threadId && newlyAddedIds.length > 0) {
      try {
        await ensureChatParticipantsForThread(serviceClient, threadId, newlyAddedIds)
        for (const uid of newlyAddedIds) {
          await insertGroupMembershipSystemMessage(serviceClient, {
            threadId,
            subjectUserId: uid,
            kind: 'joined',
          })
        }
      } catch (chatErr) {
        console.error('Group invite: chat thread sync failed', chatErr)
      }
    }

    return jsonResponse({
      added_user_ids: newlyAddedIds,
      already_member_user_ids: alreadyActiveIds,
      added_count: insertIds.length + reactivatedIds.length,
      already_member_count: alreadyActiveIds.length,
      member_count: memberCount,
      threadId,
      group_chat_notified: Boolean(threadId && newlyAddedIds.length > 0),
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to invite users to group', 500)
  }
}

