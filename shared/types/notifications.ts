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
  | 'reel_share'
  // Social
  | 'follow'
  | 'mention'
  // Friend requests
  | 'friend_request'
  | 'friend_request_accepted'
  | 'friend_request_confirmed'
  | 'friend_request_declined'
  // Communication
  | 'chat_message'
  | 'missed_call'
  // Other
  | 'birthday'

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

