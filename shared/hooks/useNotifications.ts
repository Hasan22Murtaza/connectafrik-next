import { useState, useEffect, useCallback } from 'react'
import { initialize, requestPermission, subscribe, unsubscribe, isSubscribed as checkIsSubscribed, sendLocalNotification } from '../utils/fcmClient'
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
      
      const supported = await initialize()
      setIsSupported(supported)
      
      if (supported) {
        const currentPermission = await requestPermission()
        setPermission(currentPermission)
        
        const subscribed = await checkIsSubscribed()
        setIsSubscribed(subscribed)
      }
    } catch (error) {
    } finally {
      setIsLoading(false)
    }
  }

  const subscribeToNotifications = useCallback(async () => {
    try {
      setIsLoading(true)
      
      const newPermission = await requestPermission()
      setPermission(newPermission)
      
      if (newPermission === 'granted') {
        const subscription = await subscribe()
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

  const unsubscribeFromNotifications = useCallback(async () => {
    try {
      setIsLoading(true)
      
      const success = await unsubscribe()
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
      await sendLocalNotification({
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
    subscribe: subscribeToNotifications,
    unsubscribe: unsubscribeFromNotifications,
    sendTestNotification
  }
}