import type { SupabaseClient } from '@supabase/supabase-js'
import { lookupGroupChatThreadId } from '@/lib/chat/chatThreadLookup'
import {
  ensureChatParticipantsForThread,
  insertGroupMembershipSystemMessage,
} from '@/lib/groupChatSystemMessages'
import { createNotification } from '@/lib/notifications/createNotification'
import { notificationService } from '@/shared/services/notificationService'
import { canApproveGroupJoinRequests } from '@/lib/groups/roles'
import { createServiceClient } from '@/lib/supabase-server'
import {
  sendGroupJoinRequestEmail,
  sendGroupRequestApprovedEmail,
  sendGroupRequestRejectedEmail,
} from '@/shared/services/emailService'
import { lookupUserContact } from '@/lib/emails/recipients'

export async function syncGroupMemberCount(
  serviceClient: SupabaseClient,
  groupId: string
): Promise<number> {
  const { count } = await serviceClient
    .from('group_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('status', 'active')

  const memberCount = count ?? 0
  const { error } = await serviceClient
    .from('groups')
    .update({ member_count: memberCount })
    .eq('id', groupId)

  if (error) {
    console.error('Failed to update member_count:', error)
  }

  return memberCount
}

export async function activateMembershipChat(
  serviceClient: SupabaseClient,
  groupId: string,
  userId: string
): Promise<string | null> {
  const threadId = (await lookupGroupChatThreadId(groupId)) ?? null
  if (!threadId) return null

  try {
    await ensureChatParticipantsForThread(serviceClient, threadId, [userId])
    await insertGroupMembershipSystemMessage(serviceClient, {
      threadId,
      subjectUserId: userId,
      kind: 'joined',
    })
  } catch (chatErr) {
    console.error('Group membership chat sync failed', chatErr)
  }

  return threadId
}

export async function listGroupManagerUserIds(
  serviceClient: SupabaseClient,
  groupId: string
): Promise<string[]> {
  const { data, error } = await serviceClient
    .from('group_memberships')
    .select('user_id, role')
    .eq('group_id', groupId)
    .eq('status', 'active')

  if (error) {
    console.error('Failed to list group managers:', error)
    return []
  }

  return Array.from(
    new Set(
      (data || [])
        .filter((row: { user_id: string; role: string }) => canApproveGroupJoinRequests(row.role))
        .map((row: { user_id: string }) => row.user_id)
        .filter(Boolean)
    )
  )
}

async function notifyUser(params: {
  userId: string
  type: 'group_join_request' | 'group_join_approved' | 'group_join_rejected'
  title: string
  message: string
  data: Record<string, unknown>
  accessToken: string | null
  origin?: string | null
  reactivate?: boolean
  tag?: string
}) {
  try {
    await createNotification({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data,
      reactivate: params.reactivate,
    })
  } catch (error) {
    console.error('Failed to save group join notification:', error)
  }

  try {
    await notificationService.sendNotification(
      {
        user_id: params.userId,
        title: params.title,
        body: params.message,
        notification_type: params.type,
        skip_db: true,
        tag: params.tag,
        data: params.data,
      },
      { accessToken: params.accessToken, baseUrl: params.origin }
    )
  } catch (error) {
    console.error('Failed to send group join push:', error)
  }
}

export async function notifyAdminsOfJoinRequest(params: {
  serviceClient: SupabaseClient
  groupId: string
  groupName: string
  membershipId: string
  requesterId: string
  requesterName: string
  requesterUsername?: string
  requesterAvatar?: string
  accessToken: string | null
  origin?: string | null
  reactivate?: boolean
}) {
  const managerIds = (await listGroupManagerUserIds(params.serviceClient, params.groupId)).filter(
    (id) => id !== params.requesterId
  )
  if (managerIds.length === 0) return

  const title = 'Group join request'
  const message = `${params.requesterName} requested to join ${params.groupName}.`
  const data = {
    type: 'group_join_request',
    group_id: params.groupId,
    group_name: params.groupName,
    group_join_request_id: params.membershipId,
    sender_id: params.requesterId,
    sender_name: params.requesterName,
    sender_username: params.requesterUsername || '',
    actor_id: params.requesterId,
    actor_name: params.requesterName,
    actor_avatar: params.requesterAvatar || '',
    url: `/groups/${params.groupId}?tab=requests`,
  }

  await Promise.all(
    managerIds.map((userId) =>
      notifyUser({
        userId,
        type: 'group_join_request',
        title,
        message,
        data,
        accessToken: params.accessToken,
        origin: params.origin,
        reactivate: params.reactivate,
        tag: `group-join-request-${params.membershipId}-${userId}`,
      })
    )
  )

  await Promise.all(
    managerIds.map(async (userId) => {
      try {
        const recipient = await lookupUserContact(params.serviceClient, userId)
        if (!recipient) return
        await sendGroupJoinRequestEmail(recipient.email, {
          recipientName: recipient.name,
          groupName: params.groupName,
          groupId: params.groupId,
          actorName: params.requesterName,
        })
      } catch (error) {
        console.error('Failed to send group join request email:', error)
      }
    })
  )
}

export async function notifyJoinRequestDecision(params: {
  requesterId: string
  groupId: string
  groupName: string
  membershipId: string
  approved: boolean
  actorId: string
  actorName: string
  actorAvatar?: string
  accessToken: string | null
  origin?: string | null
}) {
  if (params.requesterId === params.actorId) return

  const type = params.approved ? 'group_join_approved' : 'group_join_rejected'
  const title = params.approved ? 'Join request approved' : 'Join request declined'
  const message = params.approved
    ? `Your request to join ${params.groupName} was approved.`
    : `Your request to join ${params.groupName} was declined. You can request again later.`
  const data = {
    type,
    group_id: params.groupId,
    group_name: params.groupName,
    group_join_request_id: params.membershipId,
    actor_id: params.actorId,
    actor_name: params.actorName,
    actor_avatar: params.actorAvatar || '',
    url: `/groups/${params.groupId}`,
  }

  await notifyUser({
    userId: params.requesterId,
    type,
    title,
    message,
    data,
    accessToken: params.accessToken,
    origin: params.origin,
    tag: `group-join-${params.approved ? 'approved' : 'rejected'}-${params.membershipId}`,
  })

  try {
    const serviceClient = createServiceClient()
    const recipient = await lookupUserContact(serviceClient, params.requesterId)
    if (recipient) {
      const payload = {
        recipientName: recipient.name,
        groupName: params.groupName,
        groupId: params.groupId,
        actorName: params.actorName,
      }
      if (params.approved) {
        await sendGroupRequestApprovedEmail(recipient.email, payload)
      } else {
        await sendGroupRequestRejectedEmail(recipient.email, payload)
      }
    }
  } catch (error) {
    console.error('Failed to send group join decision email:', error)
  }
}
