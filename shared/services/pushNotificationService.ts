import { supabase } from '@/lib/supabase'

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
  private vapidPublicKey: string
  private registration: ServiceWorkerRegistration | null = null
  private subscription: PushSubscription | null = null

  constructor() {
    // Get VAPID public key from environment
    this.vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
    
    // If no VAPID key is provided, we'll use a fallback approach
    if (!this.vapidPublicKey) {
      console.warn('VITE_VAPID_PUBLIC_KEY not found. Push notifications may not work properly.')
    } else {
      // Debug: Validate VAPID key format
      this.debugVapidKey()
    }
  }

  /**
   * Debug function to validate VAPID key format
   */
  private debugVapidKey(): void {
    const key = this.vapidPublicKey
    console.log('🔍 VAPID Key Debug Info:')
    console.log('Key length:', key.length)
    console.log('Key starts with:', key.substring(0, 10))
    console.log('Key ends with:', key.substring(key.length - 10))
    console.log('Contains only valid chars:', /^[A-Za-z0-9\-_]+$/.test(key))
    console.log('Expected format (starts with BD):', key.startsWith('BD') || key.startsWith('BCTV'))
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

      // Check if push messaging is supported
      if (!('PushManager' in window)) {
        console.warn('This browser does not support push messaging')
        return false
      }

      // Register service worker (use enhanced version for production)
      const isProduction = !window.location.hostname.includes('localhost') && 
                          !window.location.hostname.includes('127.0.0.1') &&
                          !window.location.hostname.includes('vercel.app');
      
      const swPath = isProduction ? '/sw-enhanced.js' : '/sw.js';
      this.registration = await navigator.serviceWorker.register(swPath)
      console.log('Service Worker registered:', this.registration)

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready

      return true
    } catch (error) {
      console.error('Error initializing push notifications:', error)
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
   * Subscribe to push notifications
   */
  async subscribe(): Promise<PushSubscription | null> {
    try {
      if (!this.registration) {
        console.error('Service worker not registered')
        return null
      }

      // Check if VAPID key is available
      if (!this.vapidPublicKey) {
        console.error('VAPID public key not configured. Please set VITE_VAPID_PUBLIC_KEY in your environment variables.')
        return null
      }

      // Check if already subscribed
      const existingSubscription = await this.registration.pushManager.getSubscription()
      if (existingSubscription) {
        this.subscription = existingSubscription
        return existingSubscription
      }

      // Validate VAPID key format
      try {
        this.urlBase64ToUint8Array(this.vapidPublicKey)
      } catch (vapidError) {
        console.error('Invalid VAPID key format:', vapidError)
        return null
      }

      // Create new subscription
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey) as BufferSource
      })

      this.subscription = subscription

      // Save subscription to database
      await this.saveSubscription(subscription)

      console.log('Push subscription created:', subscription)
      return subscription
    } catch (error) {
      console.error('Error subscribing to push notifications:', error)
      
      // Provide helpful error messages
      if ((error as any).name === 'InvalidAccessError') {
        console.error('VAPID key is invalid. Please check your VITE_VAPID_PUBLIC_KEY environment variable.')
      } else if ((error as any).name === 'NotSupportedError') {
        console.error('Push notifications are not supported in this browser.')
      } else if ((error as any).name === 'NotAllowedError') {
        console.error('Push notifications are not allowed. Please check your browser permissions.')
      }
      
      return null
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    try {
      if (!this.subscription) {
        return true
      }

      const result = await this.subscription.unsubscribe()
      if (result) {
        // Remove subscription from database
        await this.removeSubscription()
        this.subscription = null
      }

      return result
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error)
      return false
    }
  }

  /**
   * Check if user is subscribed
   */
  async isSubscribed(): Promise<boolean> {
    try {
      if (!this.registration) {
        return false
      }

      const subscription = await this.registration.pushManager.getSubscription()
      return !!subscription
    } catch (error) {
      console.error('Error checking subscription status:', error)
      return false
    }
  }

  /**
   * Send a local notification (for testing)
   */
  async sendLocalNotification(payload: NotificationPayload): Promise<void> {
    if (!this.registration) {
      console.error('Service worker not registered')
      return
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
   * Save subscription to database
   */
  private async saveSubscription(subscription: PushSubscription): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No user logged in, cannot save subscription')
        return
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh_key: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth_key: this.arrayBufferToBase64(subscription.getKey('auth')!),
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,endpoint' // Handle duplicate gracefully
        })

      if (error) {
        // Ignore duplicate key errors (409 conflict) - subscription already exists
        if (error.code === '23505' || error.message?.includes('duplicate')) {
          console.log('Push subscription already exists for this user and endpoint')
          return
        }
        console.error('Error saving subscription:', error)
      }
    } catch (error) {
      console.error('Error saving push subscription:', error)
    }
  }

  /**
   * Remove subscription from database
   */
  private async removeSubscription(): Promise<void> {
    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)

      if (error) {
        console.error('Error removing subscription:', error)
      }
    } catch (error) {
      console.error('Error removing push subscription:', error)
    }
  }

  /**
   * Convert VAPID key to Uint8Array - Battle-tested version
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    try {
      // Clean the key string - remove any extra text that might be concatenated
      let cleanKey = base64String.trim()
      
      // Remove any common prefixes/suffixes that might be added
      cleanKey = cleanKey
        .replace(/^Public Key:\s*/i, '')
        .replace(/^Private Key:\s*/i, '')
        .replace(/^VAPID.*?:\s*/i, '')
        .replace(/\s*Public Key:\s*$/i, '')
        .replace(/\s*Private Key:\s*$/i, '')
        .replace(/\s*VAPID.*?:\s*$/i, '')
        .trim()
      
      // Extract only the base64url part (everything before any non-base64url characters)
      const base64Match = cleanKey.match(/^[A-Za-z0-9\-_]+/)
      if (!base64Match) {
        throw new Error('No valid base64url characters found in VAPID key')
      }
      
      cleanKey = base64Match[0]
      
      // Validate the cleaned key
      if (!cleanKey.match(/^[A-Za-z0-9\-_]+$/)) {
        throw new Error('VAPID key contains invalid characters after cleaning')
      }
      
      // Add padding if needed
      const padding = "=".repeat((4 - (cleanKey.length % 4)) % 4)
      const base64 = (cleanKey + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/")

      // Use browser's atob for reliable decoding
      const rawData = window.atob(base64)
      const outputArray = new Uint8Array(rawData.length)
      
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
      }
      
      return outputArray
    } catch (error) {
      console.error('Error converting VAPID key:', error)
      console.error('Original VAPID key value:', base64String)
      console.error('Key length:', base64String.length)
      console.error('Key starts with:', base64String.substring(0, 20))
      console.error('Key ends with:', base64String.substring(base64String.length - 20))
      throw new Error('Invalid VAPID key format. Please check your VITE_VAPID_PUBLIC_KEY environment variable.')
    }
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService()
