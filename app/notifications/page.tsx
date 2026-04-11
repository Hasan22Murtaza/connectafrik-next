'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Bell, Check, X, Filter, CheckCheck } from 'lucide-react'
import { Notification, NotificationType } from '@/shared/types/notifications'
import {
  getNotificationPayload,
  getNotificationTypeSource,
  normalizeNotificationType,
  stripLeadingEmoji,
} from '@/shared/utils/notificationRecord'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import { useProductionChat } from '@/contexts/ProductionChatContext'

type FilterType = 'all' | 'unread' | NotificationType

const NotificationsPage: React.FC = () => {
  const PAGE_SIZE = 20
  const { user } = useAuth()
  const router = useRouter()
  const { startChatWithMembers, openThread } = useProductionChat()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [stats, setStats] = useState({ total: 0, unread: 0 })
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const fetchNotifications = useCallback(async (targetPage = 0, append = false) => {
    if (!user) return

    try {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      const includeRead = filter !== 'unread'
      const res = await apiClient.get<{ data: any[]; page: number; pageSize: number; hasMore: boolean }>(
        '/api/notifications',
        {
          page: targetPage,
          limit: PAGE_SIZE,
          ...(includeRead ? { include_read: true } : {}),
        }
      )
      const data = res?.data ?? []

      const transformedNotifications: Notification[] = data.map((record: any) => {
        const payload = getNotificationPayload(record)
        const canonicalType = normalizeNotificationType(getNotificationTypeSource(record, payload))
        return {
          id: record.id,
          user_id: record.user_id,
          type: canonicalType,
          title: payload.title || record.title || getDefaultTitle(canonicalType),
          message: payload.message || record.message || payload.body || getDefaultMessage(canonicalType, payload),
          data: (payload.data || payload) as Notification['data'],
          is_read: record.is_read || false,
          created_at: record.created_at,
          updated_at: record.updated_at || record.created_at,
        }
      })

      setNotifications((prev) => {
        if (!append) return transformedNotifications
        const existingIds = new Set(prev.map((n) => n.id))
        const uniqueNew = transformedNotifications.filter((n) => !existingIds.has(n.id))
        return [...prev, ...uniqueNew]
      })
      setPage(targetPage)
      setHasMore(typeof res?.hasMore === 'boolean' ? res.hasMore : transformedNotifications.length === PAGE_SIZE)
    } catch (error) {
      console.error('Error fetching notifications:', error)
      toast.error('Failed to load notifications')
    } finally {
      if (append) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }, [user?.id, filter])

  const loadMore = useCallback(async () => {
    if (!user || loading || loadingMore || !hasMore || filter !== 'all') return
    await fetchNotifications(page + 1, true)
  }, [user?.id, loading, loadingMore, hasMore, filter, page, fetchNotifications])

  // Helper function to get default title based on notification type
  const getDefaultTitle = (type: string): string => {
    const titleMap: Record<string, string> = {
      post_like: 'New Like',
      post_comment: 'New Comment',
      post_create: 'New Post',
      post_share: 'Post Shared',
      comment_reply: 'New Reply',
      comment_like: 'Comment Liked',
      reel_like: 'Reel Liked',
      reel_comment: 'Reel Comment',
      reel_create: 'New Reel',
      reel_share: 'Reel Shared',
      follow: 'New Follower',
      mention: 'You were mentioned',
      friend_request: 'Friend Request',
      friend_request_accepted: 'Friend Request Accepted',
      chat_message: 'New Message',
      birthday: 'Birthday Reminder',
      system: 'System Notification',
      ringing: 'Incoming call',
      initiated: 'Incoming call',
      active: 'Call accepted',
      ended: 'Call ended',
      declined: 'Call declined',
      missed: 'Missed Call',
      failed: 'Call failed',
    }
    return titleMap[type] || 'New Notification'
  }

  // Helper function to get default message based on notification type
  const getDefaultMessage = (type: string, payload: any): string => {
    const actorName = payload?.actor_name || payload?.sender_name || payload?.username || 'Someone'
    const messageMap: Record<string, string> = {
      post_like: `${actorName} liked your post`,
      post_comment: `${actorName} commented on your post`,
      post_create: `${actorName} created a new post`,
      post_share: `${actorName} shared your post`,
      comment_reply: `${actorName} replied to your comment`,
      comment_like: `${actorName} liked your comment`,
      reel_like: `${actorName} liked your reel`,
      reel_comment: `${actorName} commented on your reel`,
      reel_create: `${actorName} created a new reel`,
      reel_share: `${actorName} shared your reel`,
      follow: `${actorName} started following you`,
      mention: `${actorName} mentioned you`,
      friend_request: `${actorName} sent you a friend request`,
      friend_request_accepted: `${actorName} accepted your friend request`,
      chat_message: `${actorName} sent you a message`,
      birthday: `It's ${actorName}'s birthday today!`,
      system: payload?.message || 'You have a new notification',
      ringing: `${actorName} is calling you`,
      initiated: `${actorName} is calling you`,
      active: `${actorName} accepted your call`,
      ended: `Call ended`,
      declined: `Call declined`,
      missed: `You missed a call from ${actorName}`,
      failed: `Call failed`,
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
      
      setStats(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }))
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast.error('Failed to mark notification as read')
    }
  }

  // Navigate based on notification type (mirrors dropdown behavior)
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }

    const data = notification.data || {}
    const fallbackUrl = data.url as string | undefined

    try {
      switch (notification.type) {
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
          break
        }

        // Post interactions
        case 'post_like':
        case 'post_comment':
        case 'post_share':
        case 'post_create':
        case 'post_reaction':
        case 'post_comment_like':
        case 'like': {
          const postId = data.post_id || data.content_id
          if (postId) {
            router.push(`/post/${postId}`)
          } else if (fallbackUrl) {
            router.push(fallbackUrl)
          } else {
            router.push('/feed')
          }
          break
        }

        // Reel interactions
        case 'reel_like':
        case 'reel_comment':
        case 'reel_share':
        case 'reel_create':
        case 'reel_comment_like': {
          const reelId = data.reel_id || data.content_id
          if (reelId) {
            router.push(`/reels?reel=${reelId}`)
          } else if (fallbackUrl) {
            router.push(fallbackUrl)
          } else {
            router.push('/reels')
          }
          break
        }

        case 'follow':
        case 'unfollow': {
          const followerId = data.follower_id || data.actor_id || data.user_id
          const username = data.follower_username || data.username || data.follower_name
          if (fallbackUrl) {
            router.push(fallbackUrl)
          } else if (username) {
            router.push(`/user/${username}`)
          } else if (followerId) {
            router.push(`/user/${followerId}`)
          } else {
            router.push('/feed')
          }
          break
        }

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
          break
        }

        case 'friend_request': {
          router.push(fallbackUrl || '/friends?tab=requests')
          break
        }

        case 'friend_request_declined': {
          router.push(fallbackUrl || '/friends')
          break
        }

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
          break
        }

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
          break
        }

        case 'call':
          case 'missed':
          case 'ringing':
          case 'initiated':
          case 'active':
          case 'ended':
          case 'declined':
          case 'failed': {
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
          break
        }

        
        case 'new_order': {
          const orderId = data.order_id || data.id
          if (orderId) {
            router.push(`/my-orders/${orderId}`)
          } else if (fallbackUrl) {
            router.push(fallbackUrl)
          } else {
            router.push('/my-orders')
          }
          break
        }

        default: {
          if (fallbackUrl) router.push(fallbackUrl)
          break
        }
      }
    } catch (error) {
      console.error('Error handling notification click:', error)
      if (fallbackUrl) router.push(fallbackUrl)
    }
  }

  const markAllAsRead = async () => {
    if (!user) return

    try {
      const unreadNotifications = notifications.filter(n => !n.is_read)
      if (unreadNotifications.length === 0) {
        toast.success('All notifications are already read')
        return
      }

      await apiClient.patch('/api/notifications/read-all', {})

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      )
      
      setStats(prev => ({ ...prev, unread: 0 }))
      toast.success('All notifications marked as read')
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      toast.error('Failed to mark all notifications as read')
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
      fetchNotifications(0, false)

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
            fetchNotifications(0, false)
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user?.id, fetchNotifications])

  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading && !loadingMore && filter === 'all') {
          loadMore()
        }
      },
      { rootMargin: '300px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, filter, loadMore])

  useEffect(() => {
    const unreadCount = notifications.filter((n) => !n.is_read).length
    setStats((prev) => ({ ...prev, total: notifications.length, unread: unreadCount }))
  }, [notifications])

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
      <div className="max-w-4xl mx-auto px-2 sm:px-4 py-3 sm:py-8">
        {/* Header card */}
        <div className="bg-white rounded-xl sm:rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 mb-3 sm:mb-6">
          <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <Bell className="w-5 h-5 sm:w-8 sm:h-8 text-[#FF6900] flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Notifications</h1>
                <p className="text-xs sm:text-sm text-gray-500">
                  {stats.total} total &bull; {stats.unread} unread
                </p>
              </div>
            </div>
            {stats.unread > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center justify-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2 bg-[#FF6900] text-white text-xs sm:text-sm rounded-lg hover:bg-orange-600 active:bg-orange-700 transition-colors whitespace-nowrap flex-shrink-0"
              >
                <CheckCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Mark all as read</span>
                <span className="sm:hidden">Read all</span>
              </button>
            )}
          </div>

          {/* Filter pills - horizontally scrollable on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-3 sm:-mx-6 px-3 sm:px-6 scrollbar-hide">
            {[
              { key: 'all', label: 'All' },
              { key: 'unread', label: `Unread (${stats.unread})` },
              { key: 'post_like', label: 'Likes' },
              { key: 'post_comment', label: 'Comments' },
              { key: 'follow', label: 'Follows' },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key as FilterType)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full sm:rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors active:scale-95 ${
                  filter === item.key
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notification list */}
        <div className="space-y-2 sm:space-y-4">
          {loading ? (
            <div className="bg-white rounded-xl sm:rounded-lg shadow-sm border border-gray-200 p-8 sm:p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF6900] mx-auto mb-4"></div>
              <p className="text-sm sm:text-base text-gray-500">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-xl sm:rounded-lg shadow-sm border border-gray-200 p-8 sm:p-12 text-center">
              <Bell className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium text-base sm:text-lg mb-1 sm:mb-2">No notifications</p>
              <p className="text-xs sm:text-sm text-gray-400">
                {filter === 'unread'
                  ? "You\u2019re all caught up! No unread notifications."
                  : filter !== 'all'
                  ? `No ${filter} notifications found.`
                  : "You don\u2019t have any notifications yet."}
              </p>
            </div>
          ) : (
            <>
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`bg-white rounded-xl sm:rounded-lg shadow-sm border ${
                    !notification.is_read ? 'border-orange-200 bg-orange-50' : 'border-gray-200'
                  } p-3 sm:p-4 hover:shadow-md active:bg-gray-50 transition-all cursor-pointer`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start space-x-3 sm:space-x-4">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-50 flex items-center justify-center">
                        <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF6900]" aria-hidden />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                              {stripLeadingEmoji(notification.title)}
                            </h3>
                            {!notification.is_read && (
                              <span className="w-2 h-2 bg-[#FF6900] rounded-full flex-shrink-0"></span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600 mb-1 line-clamp-2 leading-relaxed">
                            {notification.message}
                          </p>
                          <p className="text-[11px] sm:text-xs text-gray-400">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex items-center flex-shrink-0 ml-1">
                          {!notification.is_read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                markAsRead(notification.id)
                              }}
                              className="p-2 text-gray-400 hover:text-[#FF6900] hover:bg-orange-50 active:bg-orange-100 rounded-full transition-colors"
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
              ))}

              {filter === 'all' && <div ref={loadMoreRef} className="h-1" />}

              {filter === 'all' && loadingMore && (
                <div className="py-4 text-center text-sm text-gray-500">Loading more notifications...</div>
              )}

              {filter === 'all' && !hasMore && notifications.length >= PAGE_SIZE && (
                <div className="py-4 text-center text-sm text-gray-400">You&apos;ve reached the end of notifications</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default NotificationsPage

