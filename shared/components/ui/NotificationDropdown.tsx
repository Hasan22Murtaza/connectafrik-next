import React, { useState, useRef, useEffect } from 'react'
import { Bell, Check, X, Heart, MessageCircle, Share2, UserPlus, AtSign } from 'lucide-react'
// import { useNotifications } from '../../hooks/useNotifications' // Temporarily disabled
import { Notification } from '@/shared/types/notifications'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

interface NotificationDropdownProps {
  isOpen: boolean
  onClose: () => void
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose }) => {
  // Temporarily disable the old notification system to prevent errors
  const notifications: any[] = []
  const loading = false
  const stats = { unread: 0 }
  const markAsRead = (id: string) => {}
  const markAllAsRead = () => {}
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }
    // TODO: Navigate to the relevant content based on notification type
    onClose()
  }

  const handleMarkAllAsRead = async () => {
    await markAllAsRead()
    toast.success('All notifications marked as read')
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'post_like':
      case 'reel_like':
      case 'comment_like':
        return <Heart className="w-4 h-4 text-red-500" />
      case 'post_comment':
      case 'reel_comment':
      case 'comment_reply':
        return <MessageCircle className="w-4 h-4 text-blue-500" />
      case 'post_share':
      case 'reel_share':
        return <Share2 className="w-4 h-4 text-green-500" />
      case 'follow':
        return <UserPlus className="w-4 h-4 text-purple-500" />
      case 'mention':
        return <AtSign className="w-4 h-4 text-orange-500" />
      case 'birthday':
        return <span className="text-lg">🎂</span>
      default:
        return <Bell className="w-4 h-4 text-gray-500" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'post_like':
      case 'reel_like':
      case 'comment_like':
        return 'bg-red-50 border-red-200'
      case 'post_comment':
      case 'reel_comment':
      case 'comment_reply':
        return 'bg-blue-50 border-blue-200'
      case 'post_share':
      case 'reel_share':
        return 'bg-green-50 border-green-200'
      case 'follow':
        return 'bg-purple-50 border-purple-200'
      case 'mention':
        return 'bg-orange-50 border-orange-200'
      case 'birthday':
        return 'bg-pink-50 border-pink-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  if (!isOpen) return null

  return (
    <div className="absolute sm:right-0 -right-6 mt-2 w-62 sm:w-80 max-w-[90vw] sm:max-w-[90vw] bg-white rounded-lg shadow-lg border border-gray-200 z-[120] transform -translate-x-0 sm:translate-x-0">
      <div ref={dropdownRef}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Notifications</h3>
          <div className="flex items-center space-x-2">
            {stats.unread > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark all as read
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-80 sm:max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-3 sm:p-4 text-center text-gray-500">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 sm:p-8 text-center">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No notifications</p>
              <p className="text-sm text-gray-400 mt-1">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-3 sm:p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                    !notification.is_read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start space-x-2 sm:space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 sm:p-4 border-t border-gray-200">
            <button className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium">
              View all notifications
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationDropdown

