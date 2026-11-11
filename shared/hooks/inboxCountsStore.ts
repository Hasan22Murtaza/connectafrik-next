/**
 * Singleton inbox badge store — Header + LeftSidebar share one fetch + one realtime channel.
 */
import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api-client'
import { CHAT_THREAD_MARKED_READ_EVENT } from '@/features/chat/threadReadEvents'
import { supabaseMessagingService } from '@/features/chat/services/supabaseMessagingService'

const CALLS_LAST_VIEWED_KEY = 'header_calls_last_viewed_at'
const MISSED_BADGE_STATUSES = new Set(['missed', 'declined', 'ended'])

export type InboxCountsState = {
  unreadMessages: number
  missedCalls: number
}

type Listener = (state: InboxCountsState) => void

let state: InboxCountsState = { unreadMessages: 0, missedCalls: 0 }
let userId: string | null = null
let currentUserId: string | null = null
let currentUserMeta: { name?: string; avatarUrl?: string } = {}
const listeners = new Set<Listener>()
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let missedTimer: ReturnType<typeof setTimeout> | null = null
let channel: ReturnType<typeof supabase.channel> | null = null
let unsubscribeThreads: (() => void) | null = null
let windowListenersBound = false

function readCallsLastViewedAt(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return sessionStorage.getItem(CALLS_LAST_VIEWED_KEY) || undefined
  } catch {
    return undefined
  }
}

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

function emit() {
  for (const listener of listeners) listener(state)
}

async function fetchUnreadMessages() {
  if (!userId) {
    state = { ...state, unreadMessages: 0 }
    emit()
    return
  }
  try {
    const res = await apiClient.get<{ data: { unread_count: number } }>('/api/chat/unread-count')
    state = { ...state, unreadMessages: res?.data?.unread_count ?? 0 }
    emit()
  } catch (error) {
    console.error('Error fetching unread chat count:', error)
  }
}

async function fetchMissedCalls() {
  if (!userId) {
    state = { ...state, missedCalls: 0 }
    emit()
    return
  }
  try {
    const since = readCallsLastViewedAt()
    const res = await apiClient.get<{ data: { missed_count: number } }>(
      '/api/chat/calls/missed-count',
      since ? { since } : undefined
    )
    state = { ...state, missedCalls: res?.data?.missed_count ?? 0 }
    emit()
  } catch (error) {
    console.error('Error fetching missed call count:', error)
  }
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    void fetchUnreadMessages()
    void fetchMissedCalls()
  }, 400)
}

function scheduleMissedRefresh() {
  if (missedTimer) clearTimeout(missedTimer)
  missedTimer = setTimeout(() => {
    void fetchMissedCalls()
  }, 400)
}

function bindWindowListeners() {
  if (typeof window === 'undefined' || windowListenersBound) return
  windowListenersBound = true
  window.addEventListener(CHAT_THREAD_MARKED_READ_EVENT, () => {
    void fetchUnreadMessages()
  })
  window.addEventListener('chatThreadCreated', () => {
    scheduleRefresh()
  })
}

function ensureRealtime() {
  if (!userId || channel) return

  channel = supabase
    .channel(`header_inbox_counts:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_participants',
        filter: `user_id=eq.${userId}`,
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
}

function ensureThreadSubscription() {
  if (!currentUserId || unsubscribeThreads) return
  unsubscribeThreads = supabaseMessagingService.subscribeToUserThreads(
    {
      id: currentUserId,
      name: currentUserMeta.name || 'User',
      avatarUrl: currentUserMeta.avatarUrl,
    },
    () => {
      scheduleRefresh()
    }
  )
}

function teardown() {
  if (refreshTimer) clearTimeout(refreshTimer)
  if (missedTimer) clearTimeout(missedTimer)
  refreshTimer = null
  missedTimer = null
  if (channel) {
    try {
      supabase.removeChannel(channel)
    } catch {
      /* ignore */
    }
    channel = null
  }
  if (unsubscribeThreads) {
    try {
      unsubscribeThreads()
    } catch {
      /* ignore */
    }
    unsubscribeThreads = null
  }
}

export const inboxCountsStore = {
  getState(): InboxCountsState {
    return state
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    listener(state)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) {
        teardown()
      }
    }
  },

  setAuth(nextUserId: string | null) {
    if (userId === nextUserId) return
    teardown()
    userId = nextUserId
    if (!nextUserId) {
      state = { unreadMessages: 0, missedCalls: 0 }
      emit()
      return
    }
    bindWindowListeners()
    ensureRealtime()
    void fetchUnreadMessages()
    void fetchMissedCalls()
  },

  setCurrentUser(
    nextId: string | null | undefined,
    meta?: { name?: string; avatarUrl?: string }
  ) {
    currentUserMeta = meta || {}
    if (currentUserId === nextId) return
    if (unsubscribeThreads) {
      try {
        unsubscribeThreads()
      } catch {
        /* ignore */
      }
      unsubscribeThreads = null
    }
    currentUserId = nextId || null
    ensureThreadSubscription()
  },

  markCallsViewed() {
    if (typeof window === 'undefined') return
    const viewedAt = new Date().toISOString()
    try {
      sessionStorage.setItem(CALLS_LAST_VIEWED_KEY, viewedAt)
    } catch {
      /* ignore */
    }
    state = { ...state, missedCalls: 0 }
    emit()
    void apiClient.patch('/api/chat/calls/read-all', {}).catch((error) => {
      console.error('Error clearing call notifications:', error)
    })
  },

  refresh() {
    scheduleRefresh()
  },
}
