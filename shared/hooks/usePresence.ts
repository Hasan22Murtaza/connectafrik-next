'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'
import {
  initChatPresenceRealtime,
  cleanupChatPresenceRealtime,
  trackPresence,
} from '@/shared/services/chatPresenceRealtime'

/** WhatsApp-style: only online vs not (UI shows “last seen …” when not online). */
export type PresenceStatusType = 'online' | 'offline'

export type PresenceListItem = {
  id: string
  status: PresenceStatusType
  lastSeen: string
}

const HEARTBEAT_INTERVAL = 45 * 1000
const DATABASE_HEARTBEAT_INTERVAL = 60 * 1000

/**
 * From `last_seen` only: recent → online, else offline (no away/busy).
 */
export const calculateStatusFromLastSeen = (lastSeen: string | null | undefined): PresenceStatusType => {
  if (!lastSeen) return 'offline'

  const lastSeenTime = new Date(lastSeen).getTime()
  const now = Date.now()
  const diffMinutes = (now - lastSeenTime) / (1000 * 60)

  if (diffMinutes <= 5) return 'online'
  return 'offline'
}

/**
 * Display for other users. Legacy `away` / `busy` in DB → infer from `last_seen` only.
 */
export const deriveUserPresence = (row: {
  status?: string | null
  last_seen?: string | null
}): PresenceStatusType => {
  const s = row.status

  if (s == null || s === '' || s === 'offline') {
    return 'offline'
  }
  if (s === 'away' || s === 'busy') {
    return row.last_seen ? calculateStatusFromLastSeen(row.last_seen) : 'offline'
  }
  if (row.last_seen) {
    return calculateStatusFromLastSeen(row.last_seen)
  }
  if (s === 'online') {
    return 'online'
  }
  return 'offline'
}

export const formatWhatsAppLastSeen = (
  iso: string | null | undefined,
  now: Date = new Date()
): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfThatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfThatDay.getTime()) / (24 * 60 * 60 * 1000)
  )

  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
  const timeStr = timeFmt.format(d)
  const ms = now.getTime() - d.getTime()

  if (diffDays === 0) {
    if (ms < 60_000) return 'last seen just now'
    return `last seen today at ${timeStr}`
  }
  if (diffDays === 1) return `last seen yesterday at ${timeStr}`
  if (diffDays > 1 && diffDays < 7) {
    const dayName = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(d)
    return `last seen ${dayName} at ${timeStr}`
  }
  const dateFmt = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `last seen ${dateFmt.format(d)} at ${timeStr}`
}

export const formatContactPresenceLine = (
  /** Raw `profiles.status` (or pre-derived online | offline) */
  status: PresenceStatusType | string | null | undefined,
  lastSeen: string | null | undefined,
  options?: { showLastSeen?: boolean; showOnline?: boolean }
): string => {
  const showOnline = options?.showOnline !== false
  const showLastSeen = options?.showLastSeen !== false

  const display = deriveUserPresence({ status: status ?? null, last_seen: lastSeen })

  if (display === 'online' && showOnline) {
    return 'Online'
  }
  if (!showLastSeen) {
    return display === 'offline' ? 'Offline' : 'Online'
  }
  if (lastSeen) {
    return formatWhatsAppLastSeen(lastSeen)
  }
  return 'Offline'
}

/** Current user: only `online` (and `last_seen` / `last_active_at`) or clear to `null` when leaving. */
export const usePresence = () => {
  const { user } = useAuth()
  const [isInitialized, setIsInitialized] = useState(false)

  const lastDatabaseStatus = useRef<PresenceStatusType | null>(null)
  const lastDatabaseUpdateAt = useRef(0)
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cachedAccessToken = useRef<string | null>(null)
  const lifecycleUserId = useRef<string | null>(null)
  const onPagehide = useRef<((e: PageTransitionEvent) => void) | null>(null)
  const onPageshow = useRef<((e: PageTransitionEvent) => void) | null>(null)

  const refreshCachedAccessToken = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      cachedAccessToken.current = session?.access_token ?? null
    } catch {
      cachedAccessToken.current = null
    }
  }, [])

  const patchMyPresence = useCallback(
    async (status: PresenceStatusType, options: { force?: boolean } = {}): Promise<void> => {
      if (!user?.id) return
      const now = Date.now()
      const statusChanged = status !== lastDatabaseStatus.current
      const heartbeatDue = now - lastDatabaseUpdateAt.current >= DATABASE_HEARTBEAT_INTERVAL
      const shouldPersist =
        options.force === true || statusChanged || (status === 'online' && heartbeatDue)

      if (!shouldPersist) return

      try {
        await refreshCachedAccessToken()
        const iso = new Date().toISOString()
        const body: {
          status: 'online' | null
          last_seen: string
          last_active_at?: string
        } = {
          last_seen: iso,
          ...(status === 'offline'
            ? { status: null as null }
            : { status: 'online' as const, last_active_at: iso }),
        }

        await apiClient.patch('/api/users/me', body)
        lastDatabaseStatus.current = status
        lastDatabaseUpdateAt.current = now
      } catch (error) {
        console.error('Failed to update presence (API):', error)
      }
    },
    [user?.id, refreshCachedAccessToken]
  )

  const sendOfflineKeepalive = useCallback(() => {
    if (typeof window === 'undefined') return
    const run = (token: string | null): void => {
      if (!token) return
      const iso = new Date().toISOString()
      void fetch(`${window.location.origin}/api/users/me`, {
        method: 'PATCH',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: null, last_seen: iso }),
      }).catch(() => {})
    }
    if (cachedAccessToken.current) {
      run(cachedAccessToken.current)
      return
    }
    void supabase.auth.getSession().then(({ data: { session } }) => {
      cachedAccessToken.current = session?.access_token ?? null
      run(cachedAccessToken.current)
    })
  }, [])

  const detachLifecycle = useCallback(() => {
    if (typeof window === 'undefined') return
    if (onPagehide.current) {
      window.removeEventListener('pagehide', onPagehide.current)
      onPagehide.current = null
    }
    if (onPageshow.current) {
      window.removeEventListener('pageshow', onPageshow.current)
      onPageshow.current = null
    }
    lifecycleUserId.current = null
  }, [])

  const attachLifecycle = useCallback(
    (userId: string) => {
      if (typeof window === 'undefined' || lifecycleUserId.current === userId) return
      detachLifecycle()
      lifecycleUserId.current = userId
      onPagehide.current = (e: PageTransitionEvent) => {
        if (e.persisted) return
        sendOfflineKeepalive()
      }
      onPageshow.current = (e: PageTransitionEvent) => {
        if (e.persisted) {
          void patchMyPresence('online', { force: true })
        }
      }
      window.addEventListener('pagehide', onPagehide.current)
      window.addEventListener('pageshow', onPageshow.current)
    },
    [detachLifecycle, sendOfflineKeepalive, patchMyPresence]
  )

  const cleanupSession = useCallback(async () => {
    detachLifecycle()
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current)
      statusIntervalRef.current = null
    }
    lastDatabaseStatus.current = null
    lastDatabaseUpdateAt.current = 0
    await refreshCachedAccessToken()
    await cleanupChatPresenceRealtime()
    sendOfflineKeepalive()
    cachedAccessToken.current = null
  }, [detachLifecycle, sendOfflineKeepalive, refreshCachedAccessToken])

  useEffect(() => {
    if (!user?.id) {
      setIsInitialized(false)
      return
    }

    const uid = user.id
    let cancelled = false

    const run = async () => {
      await refreshCachedAccessToken()
      await patchMyPresence('online', { force: true })
      if (cancelled) return
      try {
        await initChatPresenceRealtime(uid)
      } catch (e) {
        console.error('initChatPresenceRealtime:', e)
      }
      if (cancelled) return
      setIsInitialized(true)
      attachLifecycle(uid)

      statusIntervalRef.current = setInterval(() => {
        if (lastDatabaseStatus.current === 'online') {
          void patchMyPresence('online')
          void trackPresence(uid)
        }
      }, HEARTBEAT_INTERVAL)
    }

    void run()

    return () => {
      cancelled = true
      void cleanupSession()
      setIsInitialized(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one session per user id
  }, [user?.id])

  const updateStatus = useCallback(
    async (status: PresenceStatusType) => {
      await patchMyPresence(status, { force: true })
    },
    [patchMyPresence]
  )

  return {
    isInitialized,
    updateStatus,
    formatWhatsAppLastSeen,
    formatContactPresenceLine,
  }
}
