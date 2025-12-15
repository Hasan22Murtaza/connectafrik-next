import { supabase } from '@/lib/supabase'

export interface NotificationData {
  user_id: string
  title: string
  body: string
  icon?: string
  image?: string
  badge?: string
  tag?: string
  data?: any
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
  requireInteraction?: boolean
  silent?: boolean
  vibrate?: number[]
}

class NotificationService {
  /**
   * Send a push notification to a user
   */
  async sendNotification(notificationData: NotificationData): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: notificationData
      })

      if (error) {
        console.error('Error sending push notification:', error)
        return false
      }

      return data?.success || false
    } catch (error) {
      console.error('Error in sendNotification:', error)
      return false
    }
  }

  /**
   * Send friend request notification
   */
  async sendFriendRequestNotification(recipientId: string, senderName: string): Promise<boolean> {
    return this.sendNotification({
      user_id: recipientId,
      title: 'New Friend Request',
      body: `${senderName} wants to be your friend on ConnectAfrik`,
      icon: '/assets/images/logo.png',
      badge: '/assets/images/logo.png',
      tag: 'friend-request',
      data: {
        type: 'friend_request',
        url: '/friends'
      },
      actions: [
        {
          action: 'view',
          title: 'View Request',
          icon: '/icons/view.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/dismiss.png'
        }
      ],
      requireInteraction: true,
      vibrate: [200, 100, 200]
    })
  }

  /**
   * Send message notification
   */
  async sendMessageNotification(recipientId: string, senderName: string, messagePreview: string, threadId: string): Promise<boolean> {
    return this.sendNotification({
      user_id: recipientId,
      title: `Message from ${senderName}`,
      body: messagePreview,
      icon: '/assets/images/logo.png',
      badge: '/assets/images/logo.png',
      tag: `message-${threadId}`,
      data: {
        type: 'message',
        thread_id: threadId,
        url: '/chat'
      },
      actions: [
        {
          action: 'reply',
          title: 'Reply',
          icon: '/icons/reply.png'
        },
        {
          action: 'view',
          title: 'View Chat',
          icon: '/icons/view.png'
        }
      ],
      requireInteraction: false,
      vibrate: [100, 50, 100]
    })
  }

  /**
   * Send missed call notification
   */
  async sendMissedCallNotification(recipientId: string, callerName: string, callType: 'audio' | 'video'): Promise<boolean> {
    return this.sendNotification({
      user_id: recipientId,
      title: 'Missed Call',
      body: `${callerName} tried to call you (${callType})`,
      icon: '/assets/images/logo.png',
      badge: '/assets/images/logo.png',
      tag: 'missed-call',
      data: {
        type: 'missed_call',
        call_type: callType,
        url: '/chat'
      },
      actions: [
        {
          action: 'call_back',
          title: 'Call Back',
          icon: '/icons/phone.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/dismiss.png'
        }
      ],
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300]
    })
  }

  /**
   * Send post interaction notification
   */
  async sendPostInteractionNotification(recipientId: string, actorName: string, action: 'like' | 'comment' | 'share', postTitle?: string): Promise<boolean> {
    const actionText = {
      like: 'liked your post',
      comment: 'commented on your post',
      share: 'shared your post'
    }[action]

    return this.sendNotification({
      user_id: recipientId,
      title: 'Post Interaction',
      body: `${actorName} ${actionText}${postTitle ? `: "${postTitle}"` : ''}`,
      icon: '/assets/images/logo.png',
      badge: '/assets/images/logo.png',
      tag: `post-${action}`,
      data: {
        type: 'post_interaction',
        action,
        url: '/feed'
      },
      actions: [
        {
          action: 'view',
          title: 'View Post',
          icon: '/icons/view.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/dismiss.png'
        }
      ],
      requireInteraction: false,
      vibrate: [100, 50, 100]
    })
  }

  /**
   * Send system notification
   */
  async sendSystemNotification(recipientId: string, title: string, body: string, data?: any): Promise<boolean> {
    return this.sendNotification({
      user_id: recipientId,
      title,
      body,
      icon: '/assets/images/logo.png',
      badge: '/assets/images/logo.png',
      tag: 'system-notification',
      data: {
        type: 'system',
        ...data
      },
      actions: [
        {
          action: 'view',
          title: 'View',
          icon: '/icons/view.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/dismiss.png'
        }
      ],
      requireInteraction: false,
      vibrate: [200, 100, 200]
    })
  }
}

// Export singleton instance
export const notificationService = new NotificationService()