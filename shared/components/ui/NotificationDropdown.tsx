import React, { useState, useRef, useEffect } from 'react'
import { Bell, Check, X, Heart, MessageCircle, Share2, UserPlus, AtSign, MessageSquare, Cake, ShoppingBag, PhoneMissed, ThumbsUp, Info, UserX } from 'lucide-react'
import { Notification } from '@/shared/types/notifications'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api-client'
import Link from 'next/link'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { useRouter } from 'next/navigation'

interface NotificationDropdownProps {
  isOpen: boolean
  onClose: () => void
  onUnreadCountChange?: (count: number) => void
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose, onUnreadCountChange }) => {
  const { user } = useAuth()
  const router = useRouter()
  const { startChatWithMembers, openThread } = useProductionChat()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ unread: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    if (!user) return

    try {
      setLoading(true)
      const res = await apiClient.get<{ data: any[] }>('/api/notifications', { limit: 50 })
      const data = res?.data ?? []

      const transformedNotifications: Notification[] = data.map((record: any) => {
        const payload = record.payload || record.data || {}
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
    } catch (error) {
      console.error('Error fetching notifications:', error)
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  const getDefaultTitle = (type: string): string => {
    const titleMap: Record<string, string> = {
      like: 'New Like',
      post_like: 'New Like',
      post_comment: 'New Comment',
      post_share: 'Post Shared',
      post_reaction: 'New Reaction',
      comment: 'New Comment',
      comment_reply: 'New Reply',
      comment_like: 'Comment Liked',
      comment_reaction: 'Comment Reaction',
      reel_like: 'Reel Liked',
      reel_comment: 'Reel Comment',
      reel_share: 'Reel Shared',
      follow: 'New Follower',
      mention: 'You were mentioned',
      friend_request: 'Friend Request',
      friend_request_accepted: 'Friend Request Accepted',
      friend_request_confirmed: 'Friend Request Confirmed',
      friend_request_declined: 'Friend Request Declined',
      chat_message: 'New Message',
      missed_call: 'Missed Call',
      birthday: 'Birthday Reminder',
      new_order: 'New Order',
      system: 'System Notification',
    }
    return titleMap[type] || 'New Notification'
  }

  const getDefaultMessage = (type: string, payload: any): string => {
    const actorName = payload?.actor_name || payload?.sender_name || payload?.username || 'Someone'
    const messageMap: Record<string, string> = {
      like: `${actorName} liked your post`,
      post_like: `${actorName} liked your post`,
      post_comment: `${actorName} commented on your post`,
      post_share: `${actorName} shared your post`,
      post_reaction: `${actorName} reacted to your post`,
      comment: `${actorName} commented on your post`,
      comment_reply: `${actorName} replied to your comment`,
      comment_like: `${actorName} liked your comment`,
      comment_reaction: `${actorName} reacted to your comment`,
      reel_like: `${actorName} liked your reel`,
      reel_comment: `${actorName} commented on your reel`,
      reel_share: `${actorName} shared your reel`,
      follow: `${actorName} started following you`,
      mention: `${actorName} mentioned you`,
      friend_request: `${actorName} sent you a friend request`,
      friend_request_accepted: `${actorName} accepted your friend request`,
      friend_request_confirmed: `${actorName} confirmed your friend request`,
      friend_request_declined: `${actorName} declined your friend request`,
      chat_message: `${actorName} sent you a message`,
      missed_call: `You missed a call from ${actorName}`,
      birthday: `It's ${actorName}'s birthday today!`,
      new_order: `${actorName} placed a new order`,
      system: payload?.message || 'You have a new notification',
    }
    return messageMap[type] || 'You have a new notification'
  }

  const markAsRead = async (id: string) => {
    if (!user) return

    try {
      await apiClient.patch(`/api/notifications/${id}/read`, {})

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

      await apiClient.patch('/api/notifications/read-all', {})

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
        const res = await apiClient.get<{ data: { unread_count: number } }>('/api/notifications/unread-count')
        onUnreadCountChange?.(res?.data?.unread_count ?? 0)
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
            apiClient.get<{ data: { unread_count: number } }>('/api/notifications/unread-count')
              .then((res) => {
                onUnreadCountChange?.(res?.data?.unread_count ?? 0)
              })
              .catch(() => {})
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

  // Navigate based on notification type
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }

    const data = notification.data || {}

    // Helper: if data has a url field, use it as fallback
    const fallbackUrl = data.url as string | undefined

    try {
      switch (notification.type) {
        // Chat message → open chat window for reply
        case 'chat_message': {
          const threadId = data.thread_id || data.chat_thread_id
          const actorId = data.sender_id || data.actor_id || data.user_id
          const actorName = data.sender_name || data.actor_name || data.username || 'User'
          const actorAvatar = data.actor_avatar || data.avatar_url || ''

          if (threadId) {
            openThread(threadId)
          } else if (actorId) {
            await startChatWithMembers(
              [{ id: actorId, name: actorName, avatarUrl: actorAvatar }],
              { participant_ids: [actorId], type: 'direct', openInDock: true }
            )
          }
          onClose()
          break
        }

        // Post interactions → navigate to view the post
        case 'post_like':
        case 'post_comment':
        case 'post_share':
        case 'post_reaction':
        case 'like': {
          const postId = data.post_id || data.content_id
          if (postId) {
            router.push(`/post/${postId}`)
          } else if (fallbackUrl) {
            router.push(fallbackUrl)
          } else {
            router.push('/feed')
          }
          onClose()
          break
        }

        // Comment interactions → navigate to the post with comment
        case 'comment':
        case 'comment_reply':
        case 'comment_like':
        case 'comment_reaction': {
          const postId = data.post_id || data.content_id
          const commentId = data.comment_id
          if (postId) {
            router.push(`/post/${postId}${commentId ? `?comment=${commentId}` : ''}`)
          } else if (fallbackUrl) {
            router.push(fallbackUrl)
          } else {
            router.push('/feed')
          }
          onClose()
          break
        }

        // Reel interactions → navigate to the reel
        case 'reel_like':
        case 'reel_comment':
        case 'reel_share': {
          const reelId = data.reel_id || data.content_id
          if (reelId) {
            router.push(`/reels?reel=${reelId}`)
          } else if (fallbackUrl) {
            router.push(fallbackUrl)
          } else {
            router.push('/reels')
          }
          onClose()
          break
        }

        // Follow / Tap In → navigate to follower's profile
        case 'follow': {
          console.log(data);
          const followerId = data.follower_id || data.actor_id || data.user_id
          const username =  data.follower_name
          if (fallbackUrl) {
            router.push(fallbackUrl)
          } else if (username) {
            router.push(`/user/${username}`)
          } else if (followerId) {
            router.push(`/user/${followerId}`)
          }
          onClose()
          break
        }

        // Mention → navigate to the post/comment where mentioned
        case 'mention': {
          const postId = data.post_id || data.content_id
          const commentId = data.comment_id
          if (postId) {
            router.push(`/post/${postId}${commentId ? `?comment=${commentId}` : ''}`)
          } else if (fallbackUrl) {
            router.push(fallbackUrl)
          } else {
            router.push('/feed')
          }
          onClose()
          break
        }

        // Friend request → go to friend requests page
        case 'friend_request': {
          router.push(fallbackUrl || '/friends?tab=requests')
          onClose()
          break
        }

        // Friend request declined → navigate to friends page
        case 'friend_request_declined': {
          router.push(fallbackUrl || '/friends')
          onClose()
          break
        }

        // Friend request accepted → navigate to their profile
        case 'friend_request_accepted':
        case 'friend_request_confirmed': {
          const actorId = data.sender_id || data.actor_id || data.user_id
          const username = data.username || data.actor_username || data.sender_name
          if (fallbackUrl) {
            router.push(fallbackUrl)
          } else if (username) {
            router.push(`/user/${username}`)
          } else if (actorId) {
            router.push(`/user/${actorId}`)
          }
          onClose()
          break
        }

        // Birthday → open chat window to send wishes
        case 'birthday': {
          const actorId = data.actor_id || data.user_id || data.birthday_user_id
          const actorName = data.actor_name || data.username || data.name || data.follower_name || 'Friend'
          const actorAvatar = data.actor_avatar || data.avatar_url || ''

          if (actorId) {
            await startChatWithMembers(
              [{ id: actorId, name: actorName, avatarUrl: actorAvatar }],
              { participant_ids: [actorId], type: 'direct', openInDock: true }
            )
          }
          onClose()
          break
        }

        // Missed call → open chat with caller
        case 'missed_call': {
          const threadId = data.thread_id || data.chat_thread_id
          const actorId = data.caller_id || data.sender_id || data.actor_id || data.user_id
          const actorName = data.caller_name || data.sender_name || data.actor_name || 'User'
          const actorAvatar = data.actor_avatar || data.avatar_url || ''

          if (threadId) {
            openThread(threadId)
          } else if (actorId) {
            await startChatWithMembers(
              [{ id: actorId, name: actorName, avatarUrl: actorAvatar }],
              { participant_ids: [actorId], type: 'direct', openInDock: true }
            )
          }
          onClose()
          break
        }

        // Order notification → navigate to order detail page
        case 'new_order': {
          const orderId = data.order_id || data.id
          if (orderId) {
            router.push(`/my-orders/${orderId}`)
          } else if (fallbackUrl) {
            router.push(fallbackUrl)
          } else {
            router.push('/my-orders')
          }
          onClose()
          break
        }

        // System / default → use fallback url or just close
        default: {
          if (fallbackUrl) {
            router.push(fallbackUrl)
          }
          onClose()
          break
        }
      }
    } catch (error) {
      console.error('Error handling notification click:', error)
      // Fallback: try url from data, otherwise just close
      if (fallbackUrl) {
        router.push(fallbackUrl)
      }
      onClose()
    }
  }

  const handleMarkAllAsRead = async () => {
    await markAllAsRead()
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
      case 'post_like':
      case 'reel_like':
      case 'comment_like':
        return <Heart className="w-4 h-4 text-red-500" />
      case 'post_reaction':
      case 'comment_reaction':
        return <ThumbsUp className="w-4 h-4 text-blue-500" />
      case 'comment':
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
      case 'friend_request':
      case 'friend_request_accepted':
      case 'friend_request_confirmed':
        return <UserPlus className="w-4 h-4 text-indigo-500" />
      case 'friend_request_declined':
        return <UserX className="w-4 h-4 text-gray-500" />
      case 'chat_message':
        return <MessageSquare className="w-4 h-4 text-[#FF6900]" />
      case 'missed_call':
        return <PhoneMissed className="w-4 h-4 text-red-500" />
      case 'birthday':
        return <span className="text-lg">🎂</span>
      case 'new_order':
        return <ShoppingBag className="w-4 h-4 text-[#FF6900]" />
      case 'system':
        return <Info className="w-4 h-4 text-blue-500" />
      default:
        return <Bell className="w-4 h-4 text-gray-500" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'like':
      case 'post_like':
      case 'reel_like':
      case 'comment_like':
        return 'bg-red-50 border-red-200'
      case 'post_reaction':
      case 'comment_reaction':
        return 'bg-blue-50 border-blue-200'
      case 'comment':
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
      case 'friend_request':
      case 'friend_request_accepted':
      case 'friend_request_confirmed':
        return 'bg-indigo-50 border-indigo-200'
      case 'friend_request_declined':
        return 'bg-gray-50 border-gray-200'
      case 'chat_message':
        return 'bg-orange-50 border-orange-200'
      case 'missed_call':
        return 'bg-red-50 border-red-200'
      case 'birthday':
        return 'bg-pink-50 border-pink-200'
      case 'new_order':
        return 'bg-orange-50 border-orange-200'
      case 'system':
        return 'bg-blue-50 border-blue-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  if (!isOpen) return null

  return (
    <div className="absolute sm:right-0 -right-6 mt-2 w-56 sm:w-80 max-w-[90vw] bg-white rounded-lg shadow-lg border border-gray-200 z-[120] overflow-hidden">
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

        <div className="max-h-80 sm:max-h-96 overflow-y-auto overflow-x-hidden">
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
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-[#FF6900] rounded-full"></div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1 break-words overflow-hidden">
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
