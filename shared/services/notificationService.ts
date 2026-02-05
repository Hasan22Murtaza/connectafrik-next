import type { NotificationType } from '@/shared/types/notifications'

export interface NotificationData {
  user_id: string
  title: string
  body: string
  notification_type?: NotificationType
  skip_db?: boolean
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
  notification_id?: string | null
  sent?: number
  failed?: number
  total?: number
  message?: string
  error?: string
  results?: Array<{
    success: boolean
    endpoint?: string
    device_type?: string
    messageId?: string
    error?: string
  }>
}

export interface NotificationConfig {
  baseUrl?: string
}

let config: NotificationConfig = {
  baseUrl: ''
}


export async function sendNotification(notificationData: NotificationData): Promise<NotificationResponse> {
  try {
    // Validate required fields
    if (!notificationData.user_id || !notificationData.title || !notificationData.body) {
      console.error('❌ Missing required notification fields:', {
        hasUserId: !!notificationData.user_id,
        hasTitle: !!notificationData.title,
        hasBody: !!notificationData.body
      })
      return {
        success: false,
        error: 'Missing required fields: user_id, title, and body are required'
      }
    }

    console.log('📤 Sending notification:', {
      user_id: notificationData.user_id,
      title: notificationData.title,
      body: notificationData.body.substring(0, 50) + (notificationData.body.length > 50 ? '...' : ''),
      notification_type: notificationData.notification_type || 'system',
      skip_db: notificationData.skip_db || false
    })

    // Determine API URL
    const apiUrl = config.baseUrl 
      ? `${config.baseUrl}/api/push-notifications`
      : '/api/push-notifications'

    // Set defaults
    const payload: NotificationData = {
      ...notificationData,
      notification_type: notificationData.notification_type || 'system',
      icon: notificationData.icon || '/assets/images/logo.png',
      badge: notificationData.badge || '/assets/images/logo.png',
      vibrate: notificationData.vibrate || [200, 100, 200]
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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
      
      console.error('❌ Error sending notification:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        user_id: notificationData.user_id
      })
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
      }
    }

    // Parse successful response
    const result: NotificationResponse = await response.json()
    
    console.log('📬 Notification API response:', {
      success: result.success,
      notification_id: result.notification_id,
      sent: result.sent,
      failed: result.failed,
      total: result.total
    })
    
    if (result.success) {
      if (result.sent && result.sent > 0) {
        console.log('✅ Push sent to', result.sent, 'device(s)')
      }
      if (result.notification_id) {
        console.log('✅ Notification stored:', result.notification_id)
      }
    }

    // Log warnings if needed
    if (result.message?.includes('No push subscriptions')) {
      console.warn('⚠️ No push subscriptions for user:', notificationData.user_id)
    } else if (result.failed && result.failed > 0) {
      console.error('❌ Failed to send to some devices:', result.failed)
    }
    
    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Error in sendNotification:', {
      error: errorMessage,
      user_id: notificationData.user_id,
      title: notificationData.title
    })
    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Test notification - sends a test notification to the current logged-in user
 * Use this to verify notifications are working correctly
 * 
 * @returns Promise with NotificationResponse
 */
export async function testNotification(): Promise<NotificationResponse> {
  try {
    const { supabase } = await import('@/lib/supabase')
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.error('❌ No user logged in')
      return { success: false, error: 'No user logged in' }
    }

    console.log('🧪 Sending test notification to:', user.id)
    
    return sendNotification({
      user_id: user.id,
      title: '🧪 Test Notification',
      body: 'This is a test notification from ConnectAfrik. If you see this, notifications are working!',
      notification_type: 'system',
      tag: 'test-notification',
      data: {
        type: 'test',
        url: '/feed',
        timestamp: Date.now().toString()
      }
    })
  } catch (error) {
    console.error('❌ Error in testNotification:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Export for backward compatibility
export const notificationService = {
  sendNotification,
  testNotification,
}
