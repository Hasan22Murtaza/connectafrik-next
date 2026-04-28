import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { lookupGroupChatThreadId } from '@/lib/chatThreadLookup'
import {
  insertGroupMembershipSystemMessage,
  removeChatParticipantFromThread,
} from '@/lib/groupChatSystemMessages'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const { data: updatedRows, error: updateError } = await serviceClient
      .from('group_memberships')
      .update({ status: 'left' })
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .select('id')

    if (updateError) {
      return errorResponse(updateError.message, 400)
    }
    if (!updatedRows?.length) {
      return errorResponse('Not an active member of this group', 400)
    }

    const threadId = (await lookupGroupChatThreadId(groupId)) ?? null

    if (threadId) {
      try {
        await insertGroupMembershipSystemMessage(serviceClient, {
          threadId,
          subjectUserId: user.id,
          kind: 'left',
        })
      } catch (msgErr) {
        console.error('Group leave: system message failed', msgErr)
      }
      try {
        await removeChatParticipantFromThread(serviceClient, threadId, user.id)
      } catch (partErr) {
        console.error('Group leave: remove chat participant failed', partErr)
      }
    }

    const { count } = await serviceClient
      .from('group_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('status', 'active')

    const memberCount = count ?? 0

    serviceClient
      .from('groups')
      .update({ member_count: memberCount })
      .eq('id', groupId)
      .then(({ error: syncError }) => {
        if (syncError) console.error('Failed to update member_count:', syncError)
      })

    return jsonResponse({
      success: true,
      membership_status: 'left' as const,
      left_group_chat: Boolean(threadId),
      thread_id: threadId,
      /** Caller / client can rely on this to stop subscribing to group chat for this thread */
      receives_group_messages: false,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to leave group', 500)
  }
}
