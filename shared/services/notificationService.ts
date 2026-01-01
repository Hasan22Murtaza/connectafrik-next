export interface NotificationData {
  user_id: string
  title: string
  body: string
  icon?: string
  image?: string
  badge?: string
  tag?: string
  data?: Record<string, any>
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
  requireInteraction?: boolean
  silent?: boolean
  vibrate?: number[]
}

export interface NotificationResponse {
  success: boolean
  sent?: number
  failed?: number
  total?: number
  message?: string
  error?: string
}

/**
 * Send a push notification to a user via Next.js API route
 * @param notificationData - The notification payload
 * @returns Promise resolving to true if notification was sent successfully
 */
export async function sendNotification(notificationData: NotificationData): Promise<boolean> {
  try {
    // Validate required fields
    if (!notificationData.user_id || !notificationData.title || !notificationData.body) {
      console.error('Missing required notification fields:', {
        hasUserId: !!notificationData.user_id,
        hasTitle: !!notificationData.title,
        hasBody: !!notificationData.body
      })
      return false
    }

    // Only run on client side
    if (typeof window === 'undefined') {
      console.warn('sendNotification can only be called from client-side code')
      return false
    }

    const response = await fetch('/api/push-notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notificationData),
      // Add cache control for Next.js
      cache: 'no-store',
    })

    // Handle non-OK responses
    if (!response.ok) {
      let errorData: any = {}
      try {
        errorData = await response.json()
      } catch {
        errorData = { 
          error: `HTTP ${response.status}: ${response.statusText}` 
        }
      }
      
      console.error('Error sending push notification:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      })
      return false
    }

    // Parse successful response
    const result: NotificationResponse = await response.json()
    
    if (result.success && result.sent && result.sent > 0) {
      return true
    }

    // Log if no subscriptions found (not necessarily an error)
    if (result.message?.includes('No push subscriptions')) {
      console.log('No push subscriptions found for user:', notificationData.user_id)
    }

    return result.success || false
  } catch (error) {
    // Handle network errors and other exceptions
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in sendNotification:', {
      error: errorMessage,
      notificationData: {
        user_id: notificationData.user_id,
        title: notificationData.title
      }
    })
    return false
  }
}

/**
 * Send friend request notification
 * @param recipientId - The user ID who will receive the notification
 * @param senderName - The name of the user sending the friend request
 * @returns Promise resolving to true if notification was sent successfully
 */
export async function sendFriendRequestNotification(recipientId: string, senderName: string): Promise<boolean> {
  if (!recipientId || !senderName) {
    console.error('sendFriendRequestNotification: Missing required parameters', {
      hasRecipientId: !!recipientId,
      hasSenderName: !!senderName
    })
    return false
  }

  return sendNotification({
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
 * Send message notification for new chat messages
 * @param recipientId - The user ID who will receive the notification
 * @param senderName - The name of the message sender
 * @param messagePreview - Preview text of the message
 * @param threadId - The chat thread ID
 * @returns Promise resolving to true if notification was sent successfully
 */
export async function sendMessageNotification(
  recipientId: string, 
  senderName: string, 
  messagePreview: string, 
  threadId: string
): Promise<boolean> {
  if (!recipientId || !senderName || !messagePreview || !threadId) {
    console.error('sendMessageNotification: Missing required parameters', {
      hasRecipientId: !!recipientId,
      hasSenderName: !!senderName,
      hasMessagePreview: !!messagePreview,
      hasThreadId: !!threadId
    })
    return false
  }

  // Truncate long message previews
  const truncatedPreview = messagePreview.length > 100 
    ? `${messagePreview.substring(0, 100)}...` 
    : messagePreview

  return sendNotification({
    user_id: recipientId,
    title: `Message from ${senderName}`,
    body: truncatedPreview,
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
 * @param recipientId - The user ID who will receive the notification
 * @param callerName - The name of the person who called
 * @param callType - Type of call: 'audio' or 'video'
 * @returns Promise resolving to true if notification was sent successfully
 */
export async function sendMissedCallNotification(
  recipientId: string, 
  callerName: string, 
  callType: 'audio' | 'video'
): Promise<boolean> {
  if (!recipientId || !callerName || !callType) {
    console.error('sendMissedCallNotification: Missing required parameters', {
      hasRecipientId: !!recipientId,
      hasCallerName: !!callerName,
      hasCallType: !!callType
    })
    return false
  }

  if (callType !== 'audio' && callType !== 'video') {
    console.error('sendMissedCallNotification: Invalid callType, must be "audio" or "video"', {
      callType
    })
    return false
  }

  return sendNotification({
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
 * Send post interaction notification (like, comment, or share)
 * @param recipientId - The user ID who will receive the notification
 * @param actorName - The name of the user who performed the action
 * @param action - Type of interaction: 'like', 'comment', or 'share'
 * @param postTitle - Optional post title to include in notification
 * @returns Promise resolving to true if notification was sent successfully
 */
export async function sendPostInteractionNotification(
  recipientId: string, 
  actorName: string, 
  action: 'like' | 'comment' | 'share', 
  postTitle?: string
): Promise<boolean> {
  if (!recipientId || !actorName || !action) {
    console.error('sendPostInteractionNotification: Missing required parameters', {
      hasRecipientId: !!recipientId,
      hasActorName: !!actorName,
      hasAction: !!action
    })
    return false
  }

  const validActions = ['like', 'comment', 'share']
  if (!validActions.includes(action)) {
    console.error('sendPostInteractionNotification: Invalid action, must be one of:', validActions, {
      action
    })
    return false
  }

  const actionText = {
    like: 'liked your post',
    comment: 'commented on your post',
    share: 'shared your post'
  }[action]

  // Truncate post title if too long
  const truncatedTitle = postTitle && postTitle.length > 50 
    ? `${postTitle.substring(0, 50)}...` 
    : postTitle

  return sendNotification({
    user_id: recipientId,
    title: 'Post Interaction',
    body: `${actorName} ${actionText}${truncatedTitle ? `: "${truncatedTitle}"` : ''}`,
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

export async function sendNewPostNotification(
  recipientId: string, 
  authorName: string, 
  postTitle: string,
  postId: string
): Promise<boolean> {
  if (!recipientId || !authorName || !postTitle || !postId) {
    return false
  }

  const truncatedTitle = postTitle.length > 50 
    ? `${postTitle.substring(0, 50)}...` 
    : postTitle

  return sendNotification({
    user_id: recipientId,
    title: 'New Post',
    body: `${authorName} shared a new post: "${truncatedTitle}"`,
    icon: '/assets/images/logo.png',
    badge: '/assets/images/logo.png',
    tag: `new-post-${postId}`,
    data: {
      type: 'new_post',
      post_id: postId,
      author_name: authorName,
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
 * @param recipientId - The user ID who will receive the notification
 * @param title - Notification title
 * @param body - Notification body text
 * @param data - Optional additional data to include
 * @returns Promise resolving to true if notification was sent successfully
 */
export async function sendSystemNotification(
  recipientId: string, 
  title: string, 
  body: string, 
  data?: Record<string, any>
): Promise<boolean> {
  if (!recipientId || !title || !body) {
    console.error('sendSystemNotification: Missing required parameters', {
      hasRecipientId: !!recipientId,
      hasTitle: !!title,
      hasBody: !!body
    })
    return false
  }

  return sendNotification({
    user_id: recipientId,
    title,
    body,
    icon: '/assets/images/logo.png',
    badge: '/assets/images/logo.png',
    tag: 'system-notification',
    data: {
      type: 'system',
      ...(data || {})
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

// Export a default object for backward compatibility
export const notificationService = {
  sendNotification,
  sendFriendRequestNotification,
  sendMessageNotification,
  sendMissedCallNotification,
  sendPostInteractionNotification,
  sendNewPostNotification,
  sendSystemNotification
}