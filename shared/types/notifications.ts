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
  | 'post_like'
  | 'post_comment'
  | 'post_share'
  | 'comment_reply'
  | 'comment_like'
  | 'post_reaction'
  | 'comment_reaction'
  | 'reel_like'
  | 'reel_comment'
  | 'reel_share'
  | 'follow'
  | 'mention'
  | 'friend_request'
  | 'friend_request_accepted'
  | 'friend_request_confirmed'
  | 'friend_request_declined'
  | 'chat_message'
  | 'birthday'
  | 'system'

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

