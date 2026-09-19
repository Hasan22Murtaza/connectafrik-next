import { createServiceClient } from '@/lib/supabase-server'
import type { NotificationType } from '@/shared/types/notifications'
import { sendNotification } from '@/shared/services/notificationService'
import { sendPostCreatedEmail } from '@/shared/services/emailService'
import { lookupNotificationEmailRecipient } from '@/lib/emails/recipients'
import {
  allowsInAppNotification,
  loadNotificationSettings,
  loadNotificationSettingsMap,
} from './prefs'

export function actorDisplayName(
  user: { user_metadata?: Record<string, unknown>; email?: string | null },
  fallback = 'Someone'
): string {
  const meta = user.user_metadata || {}
  const full = typeof meta.full_name === 'string' ? meta.full_name.trim() : ''
  const name = typeof meta.name === 'string' ? meta.name.trim() : ''
  return full || name || user.email || fallback
}

export async function notifyIfAllowed(params: {
  recipientId: string
  actorId?: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
  accessToken?: string | null
  skipDb?: boolean
}): Promise<void> {
  if (!params.recipientId) return
  if (params.actorId && params.actorId === params.recipientId) return

  const settings = await loadNotificationSettings(params.recipientId)
  if (!allowsInAppNotification(settings, params.type)) return

  await sendNotification(
    {
      user_id: params.recipientId,
      title: params.title,
      body: params.message,
      notification_type: params.type,
      skip_db: params.skipDb,
      data: {
        type: params.type,
        ...(params.actorId ? { actor_id: params.actorId } : {}),
        ...(params.data || {}),
      },
    },
    { accessToken: params.accessToken },
  )
}

async function followerAndFriendIds(authorId: string): Promise<string[]> {
  const db = createServiceClient()
  const [{ data: follows }, { data: friends }] = await Promise.all([
    db.from('follows').select('follower_id').eq('following_id', authorId),
    db
      .from('friend_requests')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${authorId},receiver_id.eq.${authorId}`)
      .eq('status', 'accepted'),
  ])

  const ids = new Set<string>()
  for (const row of follows || []) {
    if (row.follower_id && row.follower_id !== authorId) ids.add(row.follower_id)
  }
  for (const row of friends || []) {
    const otherId = row.sender_id === authorId ? row.receiver_id : row.sender_id
    if (otherId && otherId !== authorId) ids.add(otherId)
  }
  return [...ids]
}

export async function notifyFollowersOfContent(params: {
  authorId: string
  authorName: string
  type: 'post_create' | 'reel_create'
  title: string
  message: string
  data: Record<string, unknown>
  accessToken?: string | null
  postPreview?: string
  postId?: string
}): Promise<void> {
  const recipientIds = await followerAndFriendIds(params.authorId)
  if (recipientIds.length === 0) return

  const settingsMap = await loadNotificationSettingsMap(recipientIds)
  const allowedIds = recipientIds.filter((id) =>
    allowsInAppNotification(settingsMap.get(id)!, params.type)
  )
  if (allowedIds.length === 0) return

  await Promise.allSettled(
    allowedIds.map((recipientId) =>
      notifyIfAllowed({
        recipientId,
        actorId: params.authorId,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data,
        accessToken: params.accessToken,
      })
    )
  )

  if (params.type !== 'post_create' || !params.postId) return

  await Promise.allSettled(
    allowedIds.map(async (recipientId) => {
      const recipient = await lookupNotificationEmailRecipient(
        createServiceClient(),
        recipientId,
        params.type
      )
      if (!recipient) return
      await sendPostCreatedEmail(recipient.email, 'friend', {
        authorName: params.authorName,
        postPreview: params.postPreview || params.message,
        postId: params.postId!,
      })
    })
  )
}
