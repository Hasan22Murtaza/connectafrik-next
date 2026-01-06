'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Bell, Check, X, Heart, MessageCircle, Share2, UserPlus, AtSign, Filter, CheckCheck } from 'lucide-react'
import { Notification, NotificationType } from '@/shared/types/notifications'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import { socialService } from '@/features/social/services/socialService'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type FilterType = 'all' | 'unread' | NotificationType

const NotificationsPage: React.FC = () => {
  const { user } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [stats, setStats] = useState({ total: 0, unread: 0 })

  // Fetch notifications from database
  const fetchNotifications = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Error fetching notifications:', error)
        toast.error('Failed to load notifications')
        return
      }

      if (data) {
        // Transform database records to Notification format
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
        
        // Calculate stats
        const unreadCount = transformedNotifications.filter(n => !n.is_read).length
        setStats({ total: transformedNotifications.length, unread: unreadCount })
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [user])

  // Helper function to get default title based on notification type
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

  // Helper function to get default message based on notification type
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

  // Mark notification as read
  const markAsRead = async (id: string) => {
    try {
      const { error } = await socialService.markNotificationRead(id)
      if (error) {
        console.error('Error marking notification as read:', error)
        toast.error('Failed to mark notification as read')
        return
      }

      // Update local state
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      )
      
      // Update stats
      setStats(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }))
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast.error('Failed to mark notification as read')
    }
  }

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user) return

    try {
      const unreadNotifications = notifications.filter(n => !n.is_read)
      if (unreadNotifications.length === 0) {
        toast.info('All notifications are already read')
        return
      }

      // Mark all unread notifications as read
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (error) {
        console.error('Error marking all notifications as read:', error)
        toast.error('Failed to mark all notifications as read')
        return
      }

      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      )
      
      // Update stats
      setStats(prev => ({ ...prev, unread: 0 }))
      toast.success('All notifications marked as read')
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      toast.error('Failed to mark all notifications as read')
    }
  }

  // Get notification icon
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'post_like':
      case 'reel_like':
      case 'comment_like':
        return <Heart className="w-5 h-5 text-red-500" />
      case 'post_comment':
      case 'reel_comment':
      case 'comment_reply':
        return <MessageCircle className="w-5 h-5 text-blue-500" />
      case 'post_share':
      case 'reel_share':
        return <Share2 className="w-5 h-5 text-green-500" />
      case 'follow':
        return <UserPlus className="w-5 h-5 text-purple-500" />
      case 'mention':
        return <AtSign className="w-5 h-5 text-orange-500" />
      case 'birthday':
        return <span className="text-xl">🎂</span>
      default:
        return <Bell className="w-5 h-5 text-gray-500" />
    }
  }

  // Filter notifications based on selected filter
  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true
    if (filter === 'unread') return !notification.is_read
    return notification.type === filter
  })

  // Fetch notifications on mount and when user changes
  useEffect(() => {
    if (user) {
      fetchNotifications()

      // Subscribe to real-time notifications
      const channel = supabase
        .channel('notifications-page-changes')
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
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user, fetchNotifications])

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please sign in to view your notifications</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Bell className="w-8 h-8 text-primary-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
                <p className="text-sm text-gray-500">
                  {stats.total} total • {stats.unread} unread
                </p>
              </div>
            </div>
            {stats.unread > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2">
            <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === 'all'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === 'unread'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Unread ({stats.unread})
            </button>
            <button
              onClick={() => setFilter('post_like')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === 'post_like'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Likes
            </button>
            <button
              onClick={() => setFilter('post_comment')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === 'post_comment'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Comments
            </button>
            <button
              onClick={() => setFilter('follow')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === 'follow'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Follows
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium text-lg mb-2">No notifications</p>
              <p className="text-sm text-gray-400">
                {filter === 'unread'
                  ? "You're all caught up! No unread notifications."
                  : filter !== 'all'
                  ? `No ${filter} notifications found.`
                  : "You don't have any notifications yet."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-lg shadow-sm border ${
                  !notification.is_read ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                } p-4 hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-base font-semibold text-gray-900">
                            {notification.title}
                          </h3>
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        {!notification.is_read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Mark as read"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default NotificationsPage

