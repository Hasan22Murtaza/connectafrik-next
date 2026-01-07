import React, { useState, useRef, useEffect } from 'react'
import { Bell, Check, X, Heart, MessageCircle, Share2, UserPlus, AtSign } from 'lucide-react'
import { Notification } from '@/shared/types/notifications'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface NotificationDropdownProps {
  isOpen: boolean
  onClose: () => void
  onUnreadCountChange?: (count: number) => void
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose, onUnreadCountChange }) => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ unread: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error fetching notifications:', error)
        toast.error('Failed to load notifications')
        return
      }

      if (data) {
        const transformedNotifications: Notification[] = data.map((record: any) => {
          const payload = record.payload || {}
          return {
            id: record.id,
            user_id: record.user_id,
            type: record.type as Notification['type'],
            title: payload.title || record.title || getDefaultTitle(record.type),
            message: payload.message || record.message || payload.body || getDefaultMessage(record.type, payload),
            data: payload.data || payload,
            is_read: record.is_read || false,
            created_at: record.created_at,
            updated_at: record.updated_at || record.created_at,
          }
        })

        setNotifications(transformedNotifications)
        
        const unreadCount = transformedNotifications.filter(n => !n.is_read).length
        setStats({ unread: unreadCount })
        onUnreadCountChange?.(unreadCount)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  const getDefaultTitle = (type: string): string => {
    const titleMap: Record<string, string> = {
      post_like: 'New Like',
      post_comment: 'New Comment',
      post_share: 'Post Shared',
      comment_reply: 'New Reply',
      comment_like: 'Comment Liked',
      reel_like: 'Reel Liked',
      reel_comment: 'Reel Comment',
      reel_share: 'Reel Shared',
      follow: 'New Follower',
      mention: 'You were mentioned',
      friend_request: 'Friend Request',
      friend_request_accepted: 'Friend Request Accepted',
      chat_message: 'New Message',
      birthday: 'Birthday Reminder',
      system: 'System Notification',
    }
    return titleMap[type] || 'New Notification'
  }

  const getDefaultMessage = (type: string, payload: any): string => {
    const actorName = payload?.actor_name || payload?.sender_name || payload?.username || 'Someone'
    const messageMap: Record<string, string> = {
      post_like: `${actorName} liked your post`,
      post_comment: `${actorName} commented on your post`,
      post_share: `${actorName} shared your post`,
      comment_reply: `${actorName} replied to your comment`,
      comment_like: `${actorName} liked your comment`,
      reel_like: `${actorName} liked your reel`,
      reel_comment: `${actorName} commented on your reel`,
      reel_share: `${actorName} shared your reel`,
      follow: `${actorName} started following you`,
      mention: `${actorName} mentioned you`,
      friend_request: `${actorName} sent you a friend request`,
      friend_request_accepted: `${actorName} accepted your friend request`,
      chat_message: `${actorName} sent you a message`,
      birthday: `It's ${actorName}'s birthday today!`,
      system: payload?.message || 'You have a new notification',
    }
    return messageMap[type] || 'You have a new notification'
  }

  const markAsRead = async (id: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error marking notification as read:', error)
        toast.error('Failed to mark notification as read')
        return
      }

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      )
      
      const newUnreadCount = Math.max(0, stats.unread - 1)
      setStats({ unread: newUnreadCount })
      onUnreadCountChange?.(newUnreadCount)
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast.error('Failed to mark notification as read')
    }
  }

  const markAllAsRead = async () => {
    if (!user) return

    try {
      const unreadNotifications = notifications.filter(n => !n.is_read)
      if (unreadNotifications.length === 0) return

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true})
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (error) {
        console.error('Error marking all notifications as read:', error)
        toast.error('Failed to mark all notifications as read')
        return
      }

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      )
      
      setStats({ unread: 0 })
      onUnreadCountChange?.(0)
      toast.success('All notifications marked as read')
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      toast.error('Failed to mark all notifications as read')
    }
  }

  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!user) return

      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('id, is_read')
          .eq('user_id', user.id)
          .eq('is_read', false)

        if (!error && data) {
          const unreadCount = data.length
          onUnreadCountChange?.(unreadCount)
        }
      } catch (error) {
        console.error('Error fetching unread count:', error)
      }
    }

    if (user) {
      fetchUnreadCount()
    }
  }, [user?.id, onUnreadCountChange])

  useEffect(() => {
    if (isOpen && user) {
      fetchNotifications()

      const channel = supabase
        .channel('notifications-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchNotifications()
            if (user) {
              supabase
                .from('notifications')
                .select('id, is_read')
                .eq('user_id', user.id)
                .eq('is_read', false)
                .then(({ data, error }) => {
                  if (!error && data) {
                    onUnreadCountChange?.(data.length)
                  }
                })
            }
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [isOpen, user?.id])

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
    onClose()
  }

  const handleMarkAllAsRead = async () => {
    await markAllAsRead()
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
        return <MessageCircle className="w-4 h-4 text-orange-500" />
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
        return 'bg-orange-50 border-orange-200'
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
    <div className="absolute sm:right-0 -right-6 mt-2 w-57 sm:w-80 max-w-[90vw] sm:max-w-[90vw] bg-white rounded-lg shadow-lg border border-gray-200 z-[120] transform -translate-x-0 sm:translate-x-0">
      <div ref={dropdownRef}>
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Notifications</h3>
          <div className="flex items-center space-x-2">
            {stats.unread > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-[#FF6900] hover:text-orange-700 font-medium"
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
                    !notification.is_read ? 'bg-orange-50' : ''
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
                          <div className="w-2 h-2 bg-[#FF6900] rounded-full"></div>
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

        {notifications.length > 0 && (
          <div className="p-3 sm:p-4 border-t border-gray-200">
            <Link
              href="/notifications"
              onClick={onClose}
              className="block w-full text-center text-sm text-[#FF6900] hover:text-orange-700 font-medium"
            >
              View all notifications
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationDropdown

