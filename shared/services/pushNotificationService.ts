import { supabase } from '@/lib/supabase'
import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getMessaging, getToken, onMessage, Messaging, deleteToken } from 'firebase/messaging'

export interface NotificationPayload {
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

class PushNotificationService {
  private firebaseApp: FirebaseApp | null = null
  private messaging: Messaging | null = null
  private registration: ServiceWorkerRegistration | null = null
  private fcmToken: string | null = null

  constructor() {
    // Initialize Firebase if not already initialized
    if (typeof window !== 'undefined') {
      this.initializeFirebase()
    }
  }

  /**
   * Initialize Firebase app
   */
  private initializeFirebase(): void {
    try {
      // Check if Firebase is already initialized
      if (getApps().length > 0) {
        this.firebaseApp = getApps()[0]
        console.log('✅ Firebase already initialized')
        return
      }

      // Get Firebase config from environment variables
      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
      }

      // Validate required config
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.messagingSenderId) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Firebase config not found. Please set Firebase environment variables.')
        }
        return
      }

      this.firebaseApp = initializeApp(firebaseConfig)
      console.log('✅ Firebase initialized successfully')
    } catch (error) {
      console.error('❌ Error initializing Firebase:', error)
    }
  }

  /**
   * Initialize push notifications
   */
  async initialize(): Promise<boolean> {
    try {
      // Check if notifications are supported
      if (!('Notification' in window)) {
        console.warn('This browser does not support notifications')
        return false
      }

      // Check if service workers are supported
      if (!('serviceWorker' in navigator)) {
        console.warn('This browser does not support service workers')
        return false
      }

      // Initialize Firebase if not already done
      if (!this.firebaseApp) {
        this.initializeFirebase()
      }

      if (!this.firebaseApp) {
        console.error('Firebase not initialized. Please configure Firebase environment variables.')
        return false
      }

      // Register service worker (use enhanced version for production)
      const isProduction = !window.location.hostname.includes('localhost') && 
                          !window.location.hostname.includes('127.0.0.1') &&
                          !window.location.hostname.includes('vercel.app');
      
      const swPath = isProduction ? '/sw-enhanced.js' : '/sw.js';
      this.registration = await navigator.serviceWorker.register(swPath)
      console.log('✅ Service Worker registered:', this.registration)

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready

      // Initialize Firebase Messaging
      try {
        this.messaging = getMessaging(this.firebaseApp)
        console.log('✅ Firebase Messaging initialized')
        
        // Set up message listener for foreground messages
        onMessage(this.messaging, (payload) => {
          console.log('📬 Foreground FCM message received:', payload)
          // Handle foreground messages if needed
          // You can show a notification or update UI
        })
      } catch (error) {
        console.error('❌ Error initializing Firebase Messaging:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('❌ Error initializing push notifications:', error)
      return false
    }
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied'
    }

    let permission = Notification.permission

    if (permission === 'default') {
      permission = await Notification.requestPermission()
    }

    return permission
  }

  /**
   * Subscribe to push notifications (get FCM token)
   */
  async subscribe(): Promise<string | null> {
    try {
      // Auto-initialize if not already done
      if (!this.registration || !this.messaging) {
        console.log('🔄 Service worker or messaging not initialized, initializing now...')
        const initialized = await this.initialize()
        if (!initialized) {
          console.error('❌ Failed to initialize push notifications')
          return null
        }
      }

      if (!this.registration) {
        console.error('❌ Service worker not registered after initialization')
        return null
      }

      if (!this.messaging) {
        console.error('❌ Firebase Messaging not initialized after initialization')
        return null
      }

      // Check permission first
      const permission = await this.requestPermission()
      if (permission !== 'granted') {
        console.error('Notification permission not granted')
        return null
      }

      // Get FCM token
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || ''
      if (!vapidKey) {
        console.error('FIREBASE_VAPID_KEY not configured. Please set NEXT_PUBLIC_FIREBASE_VAPID_KEY in your .env.local file.')
        return null
      }

      console.log('🔑 Requesting FCM token...')
      const token = await getToken(this.messaging, {
        vapidKey: vapidKey,
        serviceWorkerRegistration: this.registration,
      })

      if (!token) {
        console.error('No FCM token available')
        return null
      }

      console.log('✅ FCM token obtained:', token.substring(0, 50) + '...')
      this.fcmToken = token

      // Save token to database
      await this.saveFCMToken(token)

      return token
    } catch (error: any) {
      console.error('❌ Error subscribing to FCM:', error)
      
      // Provide helpful error messages
      if (error.code === 'messaging/permission-blocked') {
        console.error('Push notifications are blocked. Please enable them in your browser settings.')
      } else if (error.code === 'messaging/permission-default') {
        console.error('Push notification permission not granted.')
      } else if (error.code === 'messaging/unsupported-browser') {
        console.error('This browser does not support FCM.')
      }
      
      return null
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    try {
      if (!this.messaging || !this.fcmToken) {
        return true
      }

      // Delete FCM token
      await deleteToken(this.messaging)
      
      // Remove token from database
      await this.removeFCMToken()
      
      this.fcmToken = null
      console.log('✅ Unsubscribed from FCM notifications')
      return true
    } catch (error) {
      console.error('❌ Error unsubscribing from FCM:', error)
      return false
    }
  }

  /**
   * Check if user is subscribed
   */
  async isSubscribed(): Promise<boolean> {
    try {
      // Auto-initialize if not already done
      if (!this.messaging || !this.registration) {
        const initialized = await this.initialize()
        if (!initialized || !this.messaging || !this.registration) {
          return false
        }
      }

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || ''
      if (!vapidKey) {
        return false
      }

      const token = await getToken(this.messaging, {
        vapidKey: vapidKey,
        serviceWorkerRegistration: this.registration,
      })
      return !!token
    } catch (error) {
      console.error('❌ Error checking subscription status:', error)
      return false
    }
  }

  /**
   * Get current FCM token
   */
  async getToken(): Promise<string | null> {
    try {
      // Auto-initialize if not already done
      if (!this.messaging || !this.registration) {
        const initialized = await this.initialize()
        if (!initialized || !this.messaging || !this.registration) {
          return null
        }
      }

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || ''
      if (!vapidKey) {
        console.error('FIREBASE_VAPID_KEY not configured')
        return null
      }

      const token = await getToken(this.messaging, {
        vapidKey: vapidKey,
        serviceWorkerRegistration: this.registration,
      })
      return token || null
    } catch (error) {
      console.error('❌ Error getting FCM token:', error)
      return null
    }
  }

  /**
   * Send a local notification (for testing)
   */
  async sendLocalNotification(payload: NotificationPayload): Promise<void> {
    // Auto-initialize if not already done
    if (!this.registration) {
      console.log('🔄 Service worker not registered, initializing now...')
      const initialized = await this.initialize()
      if (!initialized || !this.registration) {
        console.error('❌ Failed to initialize service worker for local notification')
        return
      }
    }

    const notificationOptions: any = {
      body: payload.body,
      icon: payload.icon || '/assets/images/logo.png',
      badge: payload.badge || '/assets/images/logo.png',
      tag: payload.tag,
      data: payload.data,
      actions: payload.actions,
      requireInteraction: payload.requireInteraction,
      silent: payload.silent,
      vibrate: payload.vibrate
    }

    if (payload.image) {
      notificationOptions.image = payload.image
    }

    await this.registration.showNotification(payload.title, notificationOptions)
  }

  /**
   * Detect device type and ID
   */
  private getDeviceInfo(): { device_type: 'web' | 'ios' | 'android', device_id: string | null } {
    if (typeof window === 'undefined') {
      return { device_type: 'web', device_id: null }
    }

    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
    
    // Detect device type
    let device_type: 'web' | 'ios' | 'android' = 'web'
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      device_type = 'ios'
    } else if (/android/i.test(userAgent)) {
      device_type = 'android'
    }

    // Generate or retrieve device ID
    let device_id: string | null = null
    try {
      // Try to get existing device ID from localStorage
      device_id = localStorage.getItem('fcm_device_id')
      
      if (!device_id) {
        // Generate a unique device ID
        device_id = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
        localStorage.setItem('fcm_device_id', device_id)
      }
    } catch (e) {
      // localStorage might not be available
      console.warn('Could not access localStorage for device ID')
    }

    return { device_type, device_id }
  }

  /**
   * Save FCM token to database
   */
  private async saveFCMToken(token: string): Promise<void> {
    try {
      console.log('🔄 Attempting to save FCM token to database...')
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        console.error('❌ Error getting user:', userError)
        return
      }
      
      console.log('User found:', user ? { id: user.id, email: user.email } : 'null')
      
      if (!user) {
        console.error('❌ No user logged in, cannot save FCM token')
        return
      }

      // Get device information
      const { device_type, device_id } = this.getDeviceInfo()

      const tokenData = {
        user_id: user.id,
        fcm_token: token,
        device_type: device_type,
        device_id: device_id,
        is_active: true,
        updated_at: new Date().toISOString()
      }
      
      console.log('📤 Saving FCM token data:', {
        user_id: tokenData.user_id,
        fcm_token: tokenData.fcm_token.substring(0, 50) + '...',
        device_type: tokenData.device_type,
        device_id: tokenData.device_id
      })

      // Use upsert with conflict resolution on user_id and fcm_token
      const { data, error } = await supabase
        .from('fcm_tokens')
        .upsert(tokenData, {
          onConflict: 'user_id,fcm_token',
          ignoreDuplicates: false
        })
        .select()

      if (error) {
        // Ignore duplicate key errors (23505) - token already exists
        if (error.code === '23505' || error.message?.includes('duplicate')) {
          console.log('✅ FCM token already exists for this user, updating...')
          
          // Update existing token to set is_active and updated_at
          const { error: updateError } = await supabase
            .from('fcm_tokens')
            .update({
              is_active: true,
              device_type: device_type,
              device_id: device_id,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .eq('fcm_token', token)
          
          if (updateError) {
            console.error('❌ Error updating FCM token:', updateError)
          } else {
            console.log('✅ FCM token updated successfully')
          }
          return
        }
        console.error('❌ Error saving FCM token:', error)
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
      } else {
        console.log('✅ FCM token saved successfully to database:', data)
      }
    } catch (error) {
      console.error('❌ Error saving FCM token:', error)
      console.error('Error stack:', (error as Error).stack)
    }
  }

  /**
   * Remove FCM token from database (mark as inactive instead of deleting)
   */
  private async removeFCMToken(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user || !this.fcmToken) {
        return
      }

      // Mark token as inactive instead of deleting (soft delete)
      const { error } = await supabase
        .from('fcm_tokens')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('fcm_token', this.fcmToken)

      if (error) {
        console.error('❌ Error deactivating FCM token:', error)
      } else {
        console.log('✅ FCM token deactivated in database')
      }
    } catch (error) {
      console.error('❌ Error removing FCM token:', error)
    }
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService()
