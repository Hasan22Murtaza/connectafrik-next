import React, { useState, useEffect } from 'react'
import { Bell, BellOff, Settings, X } from '@/shared/icons'
import { initialize, requestPermission, subscribe, unsubscribe, isSubscribed as checkIsSubscribed, sendLocalNotification, NotificationPayload } from '@/shared/utils/fcmClient'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface NotificationManagerProps {
  onClose?: () => void
}

export const NotificationManager: React.FC<NotificationManagerProps> = ({ onClose }) => {
  const { user } = useAuth()
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    initializeNotifications()
  }, [])

  const initializeNotifications = async () => {
    try {
      setIsLoading(true)
      
      const supported = await initialize()
      setIsSupported(supported)
      
      if (supported) {
        const currentPermission = await requestPermission()
        setPermission(currentPermission)
        
        const subscribed = await checkIsSubscribed()
        console.log('subscribed', subscribed)
        setIsSubscribed(subscribed)
      }
    } catch (error) {
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubscribe = async () => {
    try {
      setIsLoading(true)
      
      const newPermission = await requestPermission()
      setPermission(newPermission)
      
      if (newPermission === 'granted') {
        const subscription = await subscribe()
        if (subscription) {
          setIsSubscribed(true)
          toast.success('Push notifications enabled! You\'ll receive notifications for friend requests, messages, and calls.')
        } else {
          toast.error('Failed to enable push notifications. Please try again.')
        }
      } else {
        toast.error('Notification permission denied. Please enable notifications in your browser settings.')
      }
    } catch (error) {
      toast.error('Failed to enable push notifications. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnsubscribe = async () => {
    try {
      setIsLoading(true)
      
      const success = await unsubscribe()
      if (success) {
        setIsSubscribed(false)
        toast.success('Push notifications disabled.')
      } else {
        toast.error('Failed to disable push notifications. Please try again.')
      }
    } catch (error) {
      toast.error('Failed to disable push notifications. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestNotification = async () => {
    try {
      const testPayload: NotificationPayload = {
        title: 'CribsTalk Test',
        body: 'This is a test notification from CribsTalk!',
        icon: '/assets/images/logo.png',
        tag: 'test-notification',
        data: { url: '/feed' }
      }
      
      await sendLocalNotification(testPayload)
      toast.success('Test notification sent!')
    } catch (error) {
      toast.error('Failed to send test notification.')
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    onClose?.()
  }

  if (onClose) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md overflow-hidden rounded-[16px] border border-border bg-surface shadow-dropdown">
          <div className="p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-content">Push Notifications</h2>
              <button
                onClick={onClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] text-content-tertiary transition-colors duration-200 hover:bg-surface-hover hover:text-content"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-[14px] bg-surface-secondary p-3">
                <div className="flex items-center space-x-3">
                  <Bell className="w-5 h-5 text-content-secondary" />
                  <div>
                    <p className="font-medium text-content">Browser Permission</p>
                    <p className="text-sm text-content-secondary">
                      {permission === 'granted' ? 'Allowed' : 
                       permission === 'denied' ? 'Blocked' : 'Not requested'}
                    </p>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${
                  permission === 'granted' ? 'bg-primary' :
                  permission === 'denied' ? 'bg-danger' : 'bg-yellow-500'
                }`} />
              </div>

              <div className="flex items-center justify-between rounded-[14px] bg-surface-secondary p-3">
                <div className="flex items-center space-x-3">
                  <Settings className="w-5 h-5 text-content-secondary" />
                  <div>
                    <p className="font-medium text-content">ConnectAfrik Notifications</p>
                    <p className="text-sm text-content-secondary">
                      {isSubscribed ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${
                  isSubscribed ? 'bg-primary' : 'bg-content-tertiary'
                }`} />
              </div>

              <div className="space-y-3">
                {!isSubscribed ? (
                    <button
                      onClick={handleSubscribe}
                      disabled={isLoading || permission === 'denied'}
                      className="btn-primary min-h-11 w-full rounded-[14px] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Bell className="w-4 h-4" />
                      <span>{isLoading ? 'Enabling...' : 'Enable Notifications'}</span>
                    </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={handleUnsubscribe}
                      disabled={isLoading}
                      className="btn-secondary min-h-11 w-full rounded-[14px] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <BellOff className="w-4 h-4" />
                      <span>{isLoading ? 'Disabling...' : 'Disable Notifications'}</span>
                    </button>
                    
                    <button
                      onClick={handleTestNotification}
                      className="btn-primary min-h-11 w-full rounded-[14px]"
                    >
                      <Bell className="w-4 h-4" />
                      <span>Send Test Notification</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="text-sm text-content-secondary space-y-2">
                <p>You'll receive notifications for:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Friend requests</li>
                  <li>New messages</li>
                  <li>Missed calls</li>
                  <li>Post interactions</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isOpen && !onClose) return null

  if (!isSupported) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md overflow-hidden rounded-[16px] border border-border bg-surface shadow-dropdown">
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-content">Push Notifications</h2>
              <button
                onClick={handleClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] text-content-tertiary transition-colors duration-200 hover:bg-surface-hover hover:text-content"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-8 text-center">
              <BellOff className="mx-auto mb-4 h-16 w-16 text-content-tertiary" />
              <h3 className="mb-2 text-lg font-medium text-content">
                Notifications Not Supported
              </h3>
              <p className="text-content-secondary">
                Your browser doesn't support push notifications. Please use a modern browser like Chrome, Firefox, or Safari.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[16px] border border-border bg-surface shadow-dropdown">
        <div className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-content">Push Notifications</h2>
            <button
              onClick={handleClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] text-content-tertiary transition-colors duration-200 hover:bg-surface-hover hover:text-content"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-[14px] bg-surface-secondary p-3">
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5 text-content-secondary" />
                <div>
                  <p className="font-medium text-content">Browser Permission</p>
                  <p className="text-sm text-content-secondary">
                    {permission === 'granted' ? 'Allowed' : 
                     permission === 'denied' ? 'Blocked' : 'Not requested'}
                  </p>
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${
                permission === 'granted' ? 'bg-primary' :
                permission === 'denied' ? 'bg-danger' : 'bg-yellow-500'
              }`} />
            </div>

            <div className="flex items-center justify-between rounded-[14px] bg-surface-secondary p-3">
              <div className="flex items-center space-x-3">
                <Settings className="w-5 h-5 text-content-secondary" />
                <div>
                  <p className="font-medium text-content">ConnectAfrik Notifications</p>
                  <p className="text-sm text-content-secondary">
                    {isSubscribed ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${
                isSubscribed ? 'bg-primary' : 'bg-content-tertiary'
              }`} />
            </div>

            <div className="space-y-3">
              {!isSubscribed ? (
                  <button
                    onClick={handleSubscribe}
                    disabled={isLoading || permission === 'denied'}
                    className="btn-primary min-h-11 w-full rounded-[14px] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Bell className="w-4 h-4" />
                    <span>{isLoading ? 'Enabling...' : 'Enable Notifications'}</span>
                  </button>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={handleUnsubscribe}
                    disabled={isLoading}
                    className="btn-secondary min-h-11 w-full rounded-[14px] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <BellOff className="w-4 h-4" />
                    <span>{isLoading ? 'Disabling...' : 'Disable Notifications'}</span>
                  </button>
                  
                  <button
                    onClick={handleTestNotification}
                    className="btn-primary min-h-11 w-full rounded-[14px]"
                  >
                    <Bell className="w-4 h-4" />
                    <span>Send Test Notification</span>
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2 text-sm text-content-secondary">
              <p>You'll receive notifications for:</p>
              <ul className="ml-4 list-inside list-disc space-y-1">
                <li>Friend requests</li>
                <li>New messages</li>
                <li>Missed calls</li>
                <li>Post interactions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotificationManager
