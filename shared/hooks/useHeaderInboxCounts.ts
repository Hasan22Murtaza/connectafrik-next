import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api-client'
import { CHAT_THREAD_MARKED_READ_EVENT } from '@/features/chat/threadReadEvents'
import { supabaseMessagingService } from '@/features/chat/services/supabaseMessagingService'

const CALLS_LAST_VIEWED_KEY = 'header_calls_last_viewed_at'
const MISSED_BADGE_STATUSES = new Set(['missed', 'declined', 'ended'])

function readCallsLastViewedAt(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return sessionStorage.getItem(CALLS_LAST_VIEWED_KEY) || undefined
  } catch {
    return undefined
  }
}

/** Heartbeats rewrite call_sessions without changing status — those must not refresh the badge. */
function callSessionAffectsMissedBadge(payload: {
  eventType?: string
  new?: Record<string, unknown>
  old?: Record<string, unknown>
}): boolean {
  const next = String(payload.new?.status || '')
  if (!MISSED_BADGE_STATUSES.has(next)) return false
  if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') return true
  return next !== String(payload.old?.status || '')
}

export function useHeaderInboxCounts() {
  const { user } = useAuth()
  const { currentUser, callRequests } = useProductionChat()
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [missedCalls, setMissedCalls] = useState(0)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const missedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchUnreadMessages = useCallback(async () => {
    if (!user) {
      setUnreadMessages(0)
      return
    }
    try {
      const res = await apiClient.get<{ data: { unread_count: number } }>('/api/chat/unread-count')
      setUnreadMessages(res?.data?.unread_count ?? 0)
    } catch (error) {
      console.error('Error fetching unread chat count:', error)
    }
  }, [user])

  const fetchMissedCalls = useCallback(async () => {
    if (!user) {
      setMissedCalls(0)
      return
    }
    try {
      const since = readCallsLastViewedAt()
      const res = await apiClient.get<{ data: { missed_count: number } }>(
        '/api/chat/calls/missed-count',
        since ? { since } : undefined
      )
      setMissedCalls(res?.data?.missed_count ?? 0)
    } catch (error) {
      console.error('Error fetching missed call count:', error)
    }
  }, [user])

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => {
      void fetchUnreadMessages()
      void fetchMissedCalls()
    }, 400)
  }, [fetchMissedCalls, fetchUnreadMessages])

  const scheduleMissedRefresh = useCallback(() => {
    if (missedTimerRef.current) clearTimeout(missedTimerRef.current)
    missedTimerRef.current = setTimeout(() => {
      void fetchMissedCalls()
    }, 400)
  }, [fetchMissedCalls])

  const markCallsViewed = useCallback(() => {
    if (typeof window === 'undefined') return
    const viewedAt = new Date().toISOString()
    try {
      sessionStorage.setItem(CALLS_LAST_VIEWED_KEY, viewedAt)
    } catch {
      /* ignore */
    }
    setMissedCalls(0)
    void apiClient.patch('/api/chat/calls/read-all', {}).catch((error) => {
      console.error('Error clearing call notifications:', error)
    })
  }, [])

  useEffect(() => {
    void fetchUnreadMessages()
    void fetchMissedCalls()
  }, [fetchMissedCalls, fetchUnreadMessages])

  useEffect(() => {
    if (!user) return

    const onMarkedRead = () => {
      void fetchUnreadMessages()
    }
    const onThreadCreated = () => {
      scheduleRefresh()
    }

    window.addEventListener(CHAT_THREAD_MARKED_READ_EVENT, onMarkedRead as EventListener)
    window.addEventListener('chatThreadCreated', onThreadCreated as EventListener)

    return () => {
      window.removeEventListener(CHAT_THREAD_MARKED_READ_EVENT, onMarkedRead as EventListener)
      window.removeEventListener('chatThreadCreated', onThreadCreated as EventListener)
    }
  }, [fetchUnreadMessages, scheduleRefresh, user])

  useEffect(() => {
    if (!currentUser?.id) return

    const participant = {
      id: currentUser.id,
      name: currentUser.name || 'User',
      avatarUrl: currentUser.avatarUrl,
    }

    const unsubscribe = supabaseMessagingService.subscribeToUserThreads(participant, () => {
      scheduleRefresh()
    })

    return unsubscribe
  }, [currentUser, scheduleRefresh])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`header_inbox_counts:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_participants',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          scheduleRefresh()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_sessions',
        },
        (payload) => {
          if (
            !callSessionAffectsMissedBadge({
              eventType: payload.eventType,
              new: payload.new as Record<string, unknown> | undefined,
              old: payload.old as Record<string, unknown> | undefined,
            })
          ) {
            return
          }
          scheduleMissedRefresh()
        }
      )
      .subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch {
        /* ignore */
      }
    }
  }, [scheduleMissedRefresh, scheduleRefresh, user?.id])

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      if (missedTimerRef.current) clearTimeout(missedTimerRef.current)
    }
  }, [])

  const incomingCallCount = useMemo(() => Object.keys(callRequests).length, [callRequests])
  const callBadgeCount = Math.max(missedCalls, incomingCallCount)

  return {
    unreadMessages,
    callBadgeCount,
    markCallsViewed,
  }
}
