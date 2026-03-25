export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, any>
  is_read: boolean
  created_at: string
  updated_at: string
}

export type NotificationType =
  // Existing database types
  | 'like'
  | 'new_order'
  | 'system'
  // Post interactions
  | 'post_like'
  | 'post_comment'
  | 'post_comment_like'
  | 'post_create'
  | 'post_share'
  | 'post_reaction'
  // Comment interactions
  | 'comment'
  | 'comment_reply'
  | 'comment_like'
  | 'comment_reaction'
  // Reel interactions
  | 'reel_like'
  | 'reel_comment'
  | 'reel_create'
  | 'reel_share'
  | 'reel_comment_like'
  // Social
  | 'follow'
  | 'unfollow'
  | 'mention'
  // Friend requests
  | 'friend_request'
  | 'friend_request_accepted'
  | 'friend_request_confirmed'
  | 'friend_request_declined'
  // Communication
  | 'chat_message'
  | 'call'
  /** Align with call_sessions.status */
  | 'initiated'
  | 'ringing'
  | 'active'
  | 'ended'
  | 'declined'
  | 'missed'
  | 'failed'
  // Other
  | 'birthday'

/**
 * Canonical types you requested for persisted notifications.
 * (Legacy/aux types like `system`, `like`, `comment`, call session statuses, etc. may still exist in older rows.)
 */
export const CANONICAL_NOTIFICATION_TYPES = [
  'new_order',
  'post_like',
  'post_comment',
  'post_comment_like',
  'post_create',
  'post_share',
  'post_reaction',
  'reel_like',
  'reel_comment',
  'reel_create',
  'reel_share',
  'reel_comment_like',
  'follow',
  'unfollow',
  'mention',
  'friend_request',
  'friend_request_accepted',
  'friend_request_declined',
  'chat_message',
  'call',
  'birthday',
] as const satisfies readonly NotificationType[]

export type CanonicalNotificationType = (typeof CANONICAL_NOTIFICATION_TYPES)[number]

export function isCanonicalNotificationType(value: unknown): value is CanonicalNotificationType {
  return typeof value === 'string' && (CANONICAL_NOTIFICATION_TYPES as readonly string[]).includes(value)
}

export interface CreateNotificationData {
  user_id: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, any>
}

export interface NotificationFilters {
  is_read?: boolean
  type?: NotificationType
  limit?: number
  offset?: number
}

export interface NotificationStats {
  total: number
  unread: number
  by_type: Record<NotificationType, number>
}

