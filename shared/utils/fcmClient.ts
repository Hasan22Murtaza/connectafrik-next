import { supabase } from '@/lib/supabase'
import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getMessaging, getToken as getFCMToken, onMessage, Messaging, deleteToken } from 'firebase/messaging'

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

// State management
let firebaseApp: FirebaseApp | null = null
let messaging: Messaging | null = null
let registration: ServiceWorkerRegistration | null = null

/**
 * Initialize Firebase app (client-side only)
 */
const initializeFirebase = (): void => {
  try {
    if (getApps().length > 0) {
      firebaseApp = getApps()[0]
      return
    }

    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    }

    if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.messagingSenderId) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Firebase config not found')
      }
      return
    }

    firebaseApp = initializeApp(firebaseConfig)
  } catch (error) {
    console.error('❌ Error initializing Firebase:', error)
  }
}

// Initialize Firebase on module load
if (typeof window !== 'undefined') {
  initializeFirebase()
}

/**
 * Initialize push notifications (client-side browser APIs only)
 */
export const initialize = async (): Promise<boolean> => {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return false
    }

    if (!firebaseApp) {
      initializeFirebase()
    }

    if (!firebaseApp) {
      return false
    }

    const isProduction = !window.location.hostname.includes('localhost') && 
                        !window.location.hostname.includes('127.0.0.1');
    
    if (isProduction && window.location.protocol !== 'https:') {
      console.warn('⚠️ Service workers require HTTPS in production')
      return false
    }
    
    const swPath = isProduction ? '/sw-enhanced.js' : '/sw.js';
    
    registration = await navigator.serviceWorker.register(swPath, { scope: '/' })
    await navigator.serviceWorker.ready

    messaging = getMessaging(firebaseApp)
    
    // Set up message listener for foreground messages.
    // Do NOT call registration.showNotification() here: the service worker already shows
    // the notification for the same push, so showing again would cause duplicate notifications.
    // Use in-app UI (toast, banner) here if you want to surface the message when the app is open.
    onMessage(messaging, (payload) => {
      if (payload.data && typeof window !== 'undefined') {
        // Optional: dispatch a custom event so the app can show in-app UI (e.g. toast)
        window.dispatchEvent(
          new CustomEvent('fcm-foreground-message', { detail: payload })
        )
      }
    })

    return true
  } catch (error) {
    console.error('❌ Error initializing push notifications:', error)
    return false
  }
}

/**
 * Request notification permission (browser API)
 */
export const requestPermission = async (): Promise<NotificationPermission> => {
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
 * Get device info
 */
const getDeviceInfo = (): { device_type: 'web' | 'ios' | 'android', device_id: string | null } => {
  if (typeof window === 'undefined') {
    return { device_type: 'web', device_id: null }
  }

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
  
  let device_type: 'web' | 'ios' | 'android' = 'web'
  if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
    device_type = 'ios'
  } else if (/android/i.test(userAgent)) {
    device_type = 'android'
  }

  let device_id: string | null = null
  try {
    device_id = localStorage.getItem('fcm_device_id')
    if (!device_id) {
      device_id = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
      localStorage.setItem('fcm_device_id', device_id)
    }
  } catch (e) {
    console.warn('Could not access localStorage for device ID')
  }

  return { device_type, device_id }
}

/**
 * Get FCM token from Firebase (client-side only)
 */
export const getFCMTokenFromFirebase = async (): Promise<string | null> => {
  try {
    if (!messaging || !registration) {
      const initialized = await initialize()
      if (!initialized || !messaging || !registration) {
        return null
      }
    }

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || ''
    if (!vapidKey) {
      console.error('FIREBASE_VAPID_KEY not configured')
      return null
    }

    const token = await getFCMToken(messaging, {
      vapidKey: vapidKey,
      serviceWorkerRegistration: registration,
    })

    return token || null
  } catch (error: any) {
    console.error('❌ Error getting FCM token:', error)
    return null
  }
}

/**
 * Register FCM token via API
 */
export const registerToken = async (token: string): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return false
    }

    const { device_type, device_id } = getDeviceInfo()
    if (!device_id) {
      return false
    }

    const { data: { session } } = await supabase.auth.getSession()
    const authToken = session?.access_token

    const response = await fetch('/api/fcm/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
      body: JSON.stringify({
        fcm_token: token,
        device_type,
        device_id,
        user_id: user.id,
      }),
    })

    if (!response.ok) {
      return false
    }

    const result = await response.json()
    return result.success === true
  } catch (error) {
    console.error('❌ Error registering token:', error)
    return false
  }
}

/**
 * Remove FCM token via API
 */
export const removeToken = async (token: string): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !token) {
      return false
    }

    const { data: { session } } = await supabase.auth.getSession()
    const authToken = session?.access_token

    const { device_id } = getDeviceInfo()

    const url = `/api/fcm/token?user_id=${user.id}&fcm_token=${encodeURIComponent(token)}${device_id ? `&device_id=${encodeURIComponent(device_id)}` : ''}`
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
    })

    if (!response.ok) {
      return false
    }

    const result = await response.json()
    return result.success === true
  } catch (error) {
    console.error('❌ Error removing token:', error)
    return false
  }
}

/**
 * Deactivate FCM token for the current device on logout.
 * Sets is_active = false in fcm_tokens so push notifications are not sent to this user until they log in again.
 * Call this before signOut() while the session is still valid.
 */
export const deactivateTokenOnLogout = async (): Promise<void> => {
  try {
    if (typeof window === 'undefined') return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: { session } } = await supabase.auth.getSession()
    const authToken = session?.access_token
    const { device_id } = getDeviceInfo()

    if (!device_id) return

    const url = `/api/fcm/token?device_id=${encodeURIComponent(device_id)}`
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
    })

    if (response.ok) {
      console.log('🔔 FCM token deactivated for this device on logout')
    } else {
      console.warn('⚠️ Could not deactivate FCM token on logout:', response.status)
    }
  } catch (error) {
    console.warn('⚠️ Error deactivating FCM token on logout:', error)
  }
}

/**
 * Check if user has active token via API
 */
export const checkTokenStatus = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return false
    }

    const { data: { session } } = await supabase.auth.getSession()
    const authToken = session?.access_token

    const response = await fetch(`/api/fcm/token?user_id=${user.id}`, {
      headers: {
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
    })

    if (!response.ok) {
      return false
    }

    const result = await response.json()
    const activeTokens = result.tokens?.filter((t: any) => t.is_active) || []
    return activeTokens.length > 0
  } catch (error) {
    console.error('❌ Error checking token status:', error)
    return false
  }
}

/**
 * Subscribe to push notifications (get token and register via API)
 */
export const subscribe = async (): Promise<string | null> => {
  try {
    const permission = await requestPermission()
    if (permission !== 'granted') {
      return null
    }

    const token = await getFCMTokenFromFirebase()
    if (!token) {
      return null
    }

    const registered = await registerToken(token)
    if (!registered) {
      console.warn('⚠️ Token obtained but failed to register via API')
    }

    return token
  } catch (error) {
    console.error('❌ Error subscribing:', error)
    return null
  }
}

/**
 * Unsubscribe from push notifications
 */
export const unsubscribe = async (): Promise<boolean> => {
  try {
    if (!messaging) {
      return true
    }

    const token = await getFCMTokenFromFirebase()
    if (token) {
      await deleteToken(messaging)
      await removeToken(token)
    }

    return true
  } catch (error) {
    console.error('❌ Error unsubscribing:', error)
    return false
  }
}

/**
 * Check if subscribed (has active token in DB)
 */
export const isSubscribed = async (): Promise<boolean> => {
  return await checkTokenStatus()
}

/**
 * Send local notification (browser API)
 */
export const sendLocalNotification = async (payload: NotificationPayload): Promise<void> => {
  if (!registration) {
    const initialized = await initialize()
    if (!initialized || !registration) {
      throw new Error('Service worker not available')
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

  await registration.showNotification(payload.title, notificationOptions)
}

/**
 * Check and setup FCM token on login
 */
export const checkAndSetupFCMTokenOnLogin = async (): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return
    }

    const hasActiveToken = await checkTokenStatus()
    
    if (!hasActiveToken) {
      const initialized = await initialize()
      if (!initialized) {
        return
      }

      const permission = await requestPermission()
      if (permission === 'granted') {
        await subscribe()
      }
    }
  } catch (error) {
    console.error('❌ Error setting up FCM on login:', error)
  }
}
