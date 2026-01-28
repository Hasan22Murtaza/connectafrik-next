import React, { useState, useEffect } from 'react'
import { Bell, BellOff, Settings, X } from 'lucide-react'
import { initialize, requestPermission, subscribe, unsubscribe, isSubscribed, sendLocalNotification, NotificationPayload } from '@/shared/utils/fcmClient'
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
        
        const subscribed = await isSubscribed()
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
        title: 'ConnectAfrik Test',
        body: 'This is a test notification from ConnectAfrik!',
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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Push Notifications</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Bell className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Browser Permission</p>
                    <p className="text-sm text-gray-500">
                      {permission === 'granted' ? 'Allowed' : 
                       permission === 'denied' ? 'Blocked' : 'Not requested'}
                    </p>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${
                  permission === 'granted' ? 'bg-orange-500' :
                  permission === 'denied' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Settings className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">ConnectAfrik Notifications</p>
                    <p className="text-sm text-gray-500">
                      {isSubscribed ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${
                  isSubscribed ? 'bg-orange-500' : 'bg-gray-400'
                }`} />
              </div>

              <div className="space-y-3">
                {!isSubscribed ? (
                    <button
                      onClick={handleSubscribe}
                      disabled={isLoading || permission === 'denied'}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      <Bell className="w-4 h-4" />
                      <span>{isLoading ? 'Enabling...' : 'Enable Notifications'}</span>
                    </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={handleUnsubscribe}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                    >
                      <BellOff className="w-4 h-4" />
                      <span>{isLoading ? 'Disabling...' : 'Disable Notifications'}</span>
                    </button>
                    
                    <button
                      onClick={handleTestNotification}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      <Bell className="w-4 h-4" />
                      <span>Send Test Notification</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="text-sm text-gray-500 space-y-2">
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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Push Notifications</h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-center py-8">
              <BellOff className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Notifications Not Supported
              </h3>
              <p className="text-gray-500">
                Your browser doesn't support push notifications. Please use a modern browser like Chrome, Firefox, or Safari.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Push Notifications</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900">Browser Permission</p>
                  <p className="text-sm text-gray-500">
                    {permission === 'granted' ? 'Allowed' : 
                     permission === 'denied' ? 'Blocked' : 'Not requested'}
                  </p>
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${
                permission === 'granted' ? 'bg-orange-500' :
                permission === 'denied' ? 'bg-red-500' : 'bg-yellow-500'
              }`} />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Settings className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900">ConnectAfrik Notifications</p>
                  <p className="text-sm text-gray-500">
                    {isSubscribed ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${
                isSubscribed ? 'bg-orange-500' : 'bg-gray-400'
              }`} />
            </div>

            <div className="space-y-3">
              {!isSubscribed ? (
                  <button
                    onClick={handleSubscribe}
                    disabled={isLoading || permission === 'denied'}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    <Bell className="w-4 h-4" />
                    <span>{isLoading ? 'Enabling...' : 'Enable Notifications'}</span>
                  </button>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={handleUnsubscribe}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                  >
                    <BellOff className="w-4 h-4" />
                    <span>{isLoading ? 'Disabling...' : 'Disable Notifications'}</span>
                  </button>
                  
                  <button
                    onClick={handleTestNotification}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <Bell className="w-4 h-4" />
                    <span>Send Test Notification</span>
                  </button>
                </div>
              )}
            </div>

            <div className="text-sm text-gray-500 space-y-2">
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

export default NotificationManager
