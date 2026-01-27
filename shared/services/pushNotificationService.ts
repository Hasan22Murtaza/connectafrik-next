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

      // Strategy: Always try to insert first, then handle errors
      // This ensures new users get their tokens saved
      console.log('🆕 Attempting to insert/update FCM token...')
      
      // First, check if token already exists for this user
      const { data: existingToken, error: checkError } = await supabase
        .from('fcm_tokens')
        .select('id, fcm_token, is_active, user_id, device_id')
        .eq('user_id', user.id)
        .eq('fcm_token', token)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('❌ Error checking for existing token:', checkError)
      }

      if (existingToken) {
        // Token exists for this user, update it
        console.log('🔄 FCM token already exists for this user, updating...')
        const { data: updatedData, error: updateError } = await supabase
          .from('fcm_tokens')
          .update({
            is_active: true,
            device_type: device_type,
            device_id: device_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingToken.id)
          .select()

        if (updateError) {
          console.error('❌ Error updating FCM token:', updateError)
          console.error('Update error details:', {
            code: updateError.code,
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint
          })
        } else {
          console.log('✅ FCM token updated successfully:', updatedData)
          
          // Verify the token was updated
          const { data: verifyData, error: verifyError } = await supabase
            .from('fcm_tokens')
            .select('id, fcm_token, is_active, device_type, user_id')
            .eq('user_id', user.id)
            .eq('fcm_token', token)
            .eq('is_active', true)
            .maybeSingle()
          
          if (verifyError) {
            console.warn('⚠️ Could not verify updated token:', verifyError)
          } else if (verifyData) {
            console.log('✅ Token verified in database after update:', {
              id: verifyData.id,
              user_id: verifyData.user_id,
              device_type: verifyData.device_type,
              is_active: verifyData.is_active
            })
          }
        }
        return // Exit early if we updated successfully
      }

      // Token doesn't exist for this user, try to insert
      console.log('🆕 Inserting new FCM token for user...')
      
      // Try to insert first
      const { data: insertedData, error: insertError } = await supabase
        .from('fcm_tokens')
        .insert(tokenData)
        .select()

        if (insertError) {
          console.error('❌ Error inserting FCM token:', insertError)
          console.error('Insert error details:', {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint
          })

          // If insert fails due to unique constraint on fcm_token
          if (insertError.code === '23505' || insertError.message?.includes('duplicate') || insertError.message?.includes('unique')) {
            console.log('⚠️ Insert failed due to unique constraint on fcm_token')
            
            // Check if token exists for this user (maybe it was just created)
            const { data: checkAgain, error: recheckError } = await supabase
              .from('fcm_tokens')
              .select('id, user_id, fcm_token, is_active')
              .eq('user_id', user.id)
              .eq('fcm_token', token)
              .maybeSingle()

            if (recheckError && recheckError.code !== 'PGRST116') {
              console.error('❌ Error rechecking token:', recheckError)
            }

            if (checkAgain) {
              // Token exists for this user, just update it
              console.log('✅ Token found for this user after insert failure, updating...')
              const { data: updateData, error: updateError2 } = await supabase
                .from('fcm_tokens')
                .update({
                  is_active: true,
                  device_type: device_type,
                  device_id: device_id,
                  updated_at: new Date().toISOString()
                })
                .eq('id', checkAgain.id)
                .select()

              if (updateError2) {
                console.error('❌ Error updating token:', updateError2)
              } else {
                console.log('✅ FCM token updated successfully:', updateData)
              }
            } else {
              // Token doesn't exist for this user - check if it exists for another user
              // (same device, different user scenario)
              const { data: tokenForOtherUser, error: otherUserCheckError } = await supabase
                .from('fcm_tokens')
                .select('id, user_id, fcm_token, is_active')
                .eq('fcm_token', token)
                .neq('user_id', user.id)
                .maybeSingle()

              if (otherUserCheckError && otherUserCheckError.code !== 'PGRST116') {
                console.warn('⚠️ Error checking for token with other users:', otherUserCheckError)
              }

              if (tokenForOtherUser) {
                // Token exists for a different user - this means same device, different user
                console.log('⚠️ Token exists for different user. This device is being used by multiple users.')
                console.log('💡 Attempting to create new record for this user...')
                
                // Try to find any inactive token for this user and reactivate it
                const { data: inactiveToken, error: inactiveError } = await supabase
                  .from('fcm_tokens')
                  .select('id, user_id, fcm_token, is_active')
                  .eq('user_id', user.id)
                  .eq('is_active', false)
                  .maybeSingle()

                if (inactiveToken) {
                  console.log('🔄 Found inactive token for this user, reactivating with new token...')
                  const { data: reactivateData, error: reactivateError } = await supabase
                    .from('fcm_tokens')
                    .update({
                      fcm_token: token,
                      is_active: true,
                      device_type: device_type,
                      device_id: device_id,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', inactiveToken.id)
                    .select()

                  if (reactivateError) {
                    console.error('❌ Error reactivating token:', reactivateError)
                  } else {
                    console.log('✅ FCM token reactivated:', reactivateData)
                  }
                } else {
                  console.error('❌ Cannot insert token: unique constraint violation and no inactive token to update')
                  console.error('💡 This might indicate a database schema issue. FCM tokens should allow multiple users per token (same device).')
                  console.error('💡 Consider checking your database schema - there may be a unique constraint on fcm_token that prevents multiple users.')
                }
              } else {
              // Try to update any existing inactive token for this user/device
              console.log('🔄 Trying to update existing inactive token for this user/device...')
              const { data: updateData, error: updateError2 } = await supabase
                .from('fcm_tokens')
                .update({
                  fcm_token: token,
                  is_active: true,
                  device_type: device_type,
                  device_id: device_id,
                  updated_at: new Date().toISOString()
                })
                .eq('user_id', user.id)
                .eq('is_active', false)
                .select()

              if (updateError2) {
                console.error('❌ Error updating inactive token:', updateError2)
              } else if (updateData && updateData.length > 0) {
                console.log('✅ FCM token updated (from inactive):', updateData)
              } else {
                console.error('❌ No inactive token found to update. Insert failed and no fallback available.')
              }
            }
          }
        } else {
          console.log('✅ FCM token inserted successfully:', insertedData)
          
          // Verify the token was saved by querying it back
          const { data: verifyData, error: verifyError } = await supabase
            .from('fcm_tokens')
            .select('id, fcm_token, is_active, device_type')
            .eq('user_id', user.id)
            .eq('fcm_token', token)
            .eq('is_active', true)
            .maybeSingle()
          
          if (verifyError) {
            console.warn('⚠️ Could not verify saved token:', verifyError)
          } else if (verifyData) {
            console.log('✅ Token verified in database:', {
              id: verifyData.id,
              device_type: verifyData.device_type,
              is_active: verifyData.is_active
            })
          } else {
            console.warn('⚠️ Token was inserted but could not be verified')
          }
        }
      }
    } catch (error) {
      console.error('❌ Error saving FCM token:', error)
      console.error('Error stack:', (error as Error).stack)
      
      // Try to provide more helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('permission') || error.message.includes('policy')) {
          console.error('💡 This might be a Row Level Security (RLS) policy issue. Check your Supabase RLS policies for the fcm_tokens table.')
        }
        if (error.message.includes('foreign key') || error.message.includes('constraint')) {
          console.error('💡 This might be a database constraint issue. Check your fcm_tokens table schema.')
        }
      }
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
