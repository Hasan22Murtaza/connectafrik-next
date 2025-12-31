import { useState, useEffect, useCallback } from 'react'
import { pushNotificationService } from '../services/pushNotificationService'
import { useAuth } from '@/contexts/AuthContext'

export const useNotifications = () => {
  const { user } = useAuth()
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (user) {
      initializeNotifications()
    }
  }, [user])

  const initializeNotifications = async () => {
    try {
      setIsLoading(true)
      
      const supported = await pushNotificationService.initialize()
      setIsSupported(supported)
      
      if (supported) {
        const currentPermission = await pushNotificationService.requestPermission()
        setPermission(currentPermission)
        
        const subscribed = await pushNotificationService.isSubscribed()
        setIsSubscribed(subscribed)
        
        if (currentPermission === 'granted' && !subscribed) {
          const autoSubscribedKey = `push_notifications_auto_subscribed_${user?.id}`
          const hasAttemptedAutoSubscribe = typeof window !== 'undefined' 
            ? localStorage.getItem(autoSubscribedKey) === 'true'
            : false
          
          if (!hasAttemptedAutoSubscribe) {
            try {
              const subscription = await pushNotificationService.subscribe()
              if (subscription) {
                setIsSubscribed(true)
                if (typeof window !== 'undefined') {
                  localStorage.setItem(autoSubscribedKey, 'true')
                }
              }
            } catch (error) {
            }
          }
        }
      }
    } catch (error) {
    } finally {
      setIsLoading(false)
    }
  }

  const subscribe = useCallback(async () => {
    try {
      setIsLoading(true)
      
      const newPermission = await pushNotificationService.requestPermission()
      setPermission(newPermission)
      
      if (newPermission === 'granted') {
        const subscription = await pushNotificationService.subscribe()
        setIsSubscribed(!!subscription)
        return !!subscription
      }
      
      return false
    } catch (error) {
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    try {
      setIsLoading(true)
      
      const success = await pushNotificationService.unsubscribe()
      setIsSubscribed(!success)
      return success
    } catch (error) {
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const sendTestNotification = useCallback(async () => {
    try {
      await pushNotificationService.sendLocalNotification({
        title: 'ConnectAfrik Test',
        body: 'This is a test notification from ConnectAfrik!',
        icon: '/assets/images/logo.png',
        tag: 'test-notification',
        data: { url: '/feed' }
      })
      return true
    } catch (error) {
      return false
    }
  }, [])

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    sendTestNotification
  }
}