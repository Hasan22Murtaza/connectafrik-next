'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'

export type PresenceStatusType = 'online' | 'away' | 'busy' | 'offline'

export type PresenceListItem = {
  id: string
  status: PresenceStatusType
  lastSeen: string
}

const IDLE_THRESHOLD = 5 * 60 * 1000
const HEARTBEAT_INTERVAL = 45 * 1000
const DATABASE_HEARTBEAT_INTERVAL = 60 * 1000

/**
 * Derive status for another user from API profile fields (no Realtime).
 */
export const calculateStatusFromLastSeen = (
  lastSeen: string | null | undefined
): PresenceStatusType => {
  if (!lastSeen) return 'offline'

  const lastSeenTime = new Date(lastSeen).getTime()
  const now = Date.now()
  const diffMinutes = (now - lastSeenTime) / (1000 * 60)

  if (diffMinutes <= 5) return 'online'
  if (diffMinutes <= 15) return 'away'
  return 'offline'
}

/**
 * Use profile `status` from API when set; otherwise infer from `last_seen`.
 */
export const deriveUserPresence = (row: {
  status?: string | null
  last_seen?: string | null
}): PresenceStatusType => {
  const s = row.status as PresenceStatusType | undefined
  if (s && ['online', 'away', 'busy', 'offline'].includes(s)) {
    return s
  }
  return calculateStatusFromLastSeen(row.last_seen)
}

/**
 * WhatsApp-style "last seen …" line (time uses the runtime locale).
 */
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
  status: PresenceStatusType,
  lastSeen: string | null | undefined,
  options?: { showLastSeen?: boolean; showOnline?: boolean }
): string => {
  const showOnline = options?.showOnline !== false
  const showLastSeen = options?.showLastSeen !== false

  if (status === 'online' && showOnline) {
    return 'Online'
  }
  if (!showLastSeen) {
    if (status === 'offline') return 'Offline'
    return 'Active'
  }
  if (lastSeen) {
    return formatWhatsAppLastSeen(lastSeen)
  }
  if (status === 'away' || status === 'busy') {
    return 'last seen recently'
  }
  return 'Offline'
}

/** Current user: PATCH /api/users/me (singleton behavior via refs, one active session per user id). */
export const usePresence = () => {
  const { user } = useAuth()
  const [isInitialized, setIsInitialized] = useState(false)

  const lastDatabaseStatus = useRef<PresenceStatusType | null>(null)
  const lastDatabaseUpdateAt = useRef(0)
  const lastActivityTime = useRef(Date.now())
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activityRemovers = useRef<Array<() => void>>([])

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
          status: PresenceStatusType
          last_seen: string
          last_active_at?: string
        } = {
          status,
          last_seen: iso,
        }
        if (status !== 'offline') {
          body.last_active_at = iso
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
        body: JSON.stringify({ status: 'offline', last_seen: iso }),
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

  const setAway = useCallback(() => {
    if (!user?.id) return
    void patchMyPresence('away', { force: true })
  }, [user?.id, patchMyPresence])

  const setOnlineFromActivity = useCallback(() => {
    if (!user?.id) return
    void patchMyPresence('online')
  }, [user?.id, patchMyPresence])

  const setBusy = useCallback(() => {
    if (!user?.id) return
    void patchMyPresence('busy', { force: true })
  }, [user?.id, patchMyPresence])

  const clearActivityTracking = useCallback(() => {
    activityRemovers.current.forEach((r) => r())
    activityRemovers.current = []
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
      idleTimeoutRef.current = null
    }
  }, [])

  const startActivityTracking = useCallback(() => {
    if (!user?.id) return
    lastActivityTime.current = Date.now()
    clearActivityTracking()

    const handleActivity = () => {
      lastActivityTime.current = Date.now()
      if (lastDatabaseStatus.current === 'away') {
        void patchMyPresence('online', { force: true })
      }
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current)
        idleTimeoutRef.current = null
      }
      idleTimeoutRef.current = setTimeout(() => {
        void patchMyPresence('away', { force: true })
      }, IDLE_THRESHOLD)
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'] as const
    events.forEach((ev) => {
      const fn = () => {
        handleActivity()
      }
      document.addEventListener(ev, fn, { passive: true })
      activityRemovers.current.push(() => {
        document.removeEventListener(ev, fn)
      })
    })

    idleTimeoutRef.current = setTimeout(() => {
      void patchMyPresence('away', { force: true })
    }, IDLE_THRESHOLD)
  }, [user?.id, clearActivityTracking, patchMyPresence])

  const cleanupSession = useCallback(async () => {
    clearActivityTracking()
    detachLifecycle()
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current)
      statusIntervalRef.current = null
    }
    lastDatabaseStatus.current = null
    lastDatabaseUpdateAt.current = 0
    await refreshCachedAccessToken()
    sendOfflineKeepalive()
    cachedAccessToken.current = null
  }, [clearActivityTracking, detachLifecycle, sendOfflineKeepalive, refreshCachedAccessToken])

  // Session lifecycle: open → online, heartbeat, idle, close → offline (deps: user id only)
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
      setIsInitialized(true)
      startActivityTracking()
      attachLifecycle(uid)

      statusIntervalRef.current = setInterval(() => {
        if (lastDatabaseStatus.current === 'online') {
          void patchMyPresence('online')
        }
      }, HEARTBEAT_INTERVAL)
    }

    void run()

    return () => {
      cancelled = true
      void cleanupSession()
      setIsInitialized(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- single session per user id
  }, [user?.id])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        setAway()
      } else {
        setOnlineFromActivity()
        startActivityTracking()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [setAway, setOnlineFromActivity, startActivityTracking])

  const updateStatus = useCallback(
    async (status: PresenceStatusType) => {
      await patchMyPresence(status, { force: true })
    },
    [patchMyPresence]
  )

  return {
    isInitialized,
    updateStatus,
    setAway,
    setBusy,
    formatWhatsAppLastSeen,
    formatContactPresenceLine,
  }
}
