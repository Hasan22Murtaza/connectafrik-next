import { createServiceClient } from '@/lib/supabase-server'
import type { NotificationType } from '@/shared/types/notifications'
import { isCanonicalNotificationType } from '@/shared/types/notifications'

function persistableType(type: NotificationType): NotificationType {
  if (isCanonicalNotificationType(type)) return type
  if (type === 'friend_request_confirmed') return 'friend_request_accepted'
  if (type === 'like') return 'post_like'
  if (type === 'comment') return 'post_comment'
  if (type === 'comment_like') return 'post_comment_like'
  if (
    type === 'initiated' ||
    type === 'ringing' ||
    type === 'active' ||
    type === 'ended' ||
    type === 'declined' ||
    type === 'missed' ||
    type === 'failed'
  ) {
    return 'call'
  }
  return type
}

export async function createNotification(input: {
  user_id: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
  reactivate?: boolean
}): Promise<string | null> {
  const serviceSupabase = createServiceClient()
  const type = persistableType(input.type)
  const data: Record<string, unknown> = {
    ...(input.data || {}),
    type: input.data?.type || type,
  }

  const friendRequestIdValue = data['friend_request_id']
  const friendRequestId =
    type === 'friend_request' && typeof friendRequestIdValue === 'string'
      ? friendRequestIdValue.trim()
      : ''

  const groupJoinRequestIdValue = data['group_join_request_id']
  const groupJoinRequestId =
    type === 'group_join_request' && typeof groupJoinRequestIdValue === 'string'
      ? groupJoinRequestIdValue.trim()
      : ''

  const dedupeColumn = friendRequestId
    ? 'friend_request_id'
    : groupJoinRequestId
      ? 'group_join_request_id'
      : ''
  const dedupeValue = friendRequestId || groupJoinRequestId

  if (dedupeValue) {
    const { data: existing, error: lookupError } = await serviceSupabase
      .from('notifications')
      .select('id')
      .eq('user_id', input.user_id)
      .filter(`data->>${dedupeColumn}`, 'eq', dedupeValue)
      .filter('data->>type', 'eq', type)
      .limit(1)
      .maybeSingle()

    if (!lookupError && existing?.id) {
      if (input.reactivate) {
        const now = new Date().toISOString()
        await serviceSupabase
          .from('notifications')
          .update({
            is_read: false,
            title: input.title,
            message: input.message,
            data,
            created_at: now,
          })
          .eq('id', existing.id)
      }
      return existing.id
    }
  }

  const row = {
    user_id: input.user_id,
    type,
    title: input.title,
    message: input.message,
    data,
    is_read: false,
  }

  const { data: inserted, error } = await serviceSupabase
    .from('notifications')
    .insert(row)
    .select('id')
    .single()

  if (!error && inserted?.id) {
    return inserted.id
  }

  // `system` is not allowed by notifications_type_check. `group_invite` may not be yet.
  if (error && type === 'group_invite') {
    const { data: fallback, error: fallbackError } = await serviceSupabase
      .from('notifications')
      .insert({ ...row, type: 'group_join_approved', data: { ...data, type: 'group_invite' } })
      .select('id')
      .single()

    if (!fallbackError && fallback?.id) {
      return fallback.id
    }
    console.error('Notification insert fallback failed:', fallbackError)
    return null
  }

  console.error('Notification insert failed (same path as posts):', error)
  return inserted?.id ?? null
}
