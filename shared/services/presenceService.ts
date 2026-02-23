import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { apiClient } from '@/lib/api-client'

export type PresenceStatusType = 'online' | 'away' | 'busy' | 'offline'

export interface PresenceStatus {
  id: string
  status: PresenceStatusType
  lastSeen: string
  isTyping?: boolean
}

interface PresenceData {
  user_id: string
  status: PresenceStatusType
  last_seen: string
  last_activity: string
}

type PresenceChangeCallback = (userId: string, status: PresenceStatusType, lastSeen: string) => void

// Constants
const IDLE_THRESHOLD = 5 * 60 * 1000 // 5 minutes
const HEARTBEAT_INTERVAL = 45 * 1000 // 45 seconds

// State management
let presenceChannel: RealtimeChannel | null = null
let statusUpdateInterval: ReturnType<typeof setInterval> | null = null
let idleTimeout: ReturnType<typeof setTimeout> | null = null
let lastActivityTime = Date.now()
const activityListeners: Array<() => void> = []
const presenceCallbacks = new Set<PresenceChangeCallback>()

/**
 * Calculate presence status from last_seen timestamp
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
 * Get current user's presence status from Realtime
 */
const getCurrentStatus = async (userId: string): Promise<PresenceStatusType> => {
  if (!presenceChannel) return 'offline'

  try {
    const state = presenceChannel.presenceState()
    if (!state || typeof state !== 'object') return 'offline'

    // Supabase presence state structure: { [key: string]: PresenceData[] }
    const allPresences = Object.values(state).flat() as unknown[]
    const userPresence = allPresences.find(
      (p: unknown): p is PresenceData =>
        typeof p === 'object' && p !== null && 'user_id' in p && (p as PresenceData).user_id === userId
    )

    return userPresence?.status ?? 'offline'
  } catch {
    return 'offline'
  }
}

/**
 * Update presence in database
 */
const updateDatabasePresence = async (
  userId: string,
  status: PresenceStatusType
): Promise<void> => {
  try {
    await apiClient.patch('/api/users/me/presence', {
      status,
      last_seen: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to update database presence:', error)
  }
}

/**
 * Start tracking user activity (mouse, keyboard, scroll, etc.)
 */
const startActivityTracking = (userId: string): void => {
  lastActivityTime = Date.now()

  const handleActivity = (): void => {
    lastActivityTime = Date.now()

    // Check if user was away and set back to online
    if (presenceChannel) {
      try {
        const state = presenceChannel.presenceState()
        if (state && typeof state === 'object') {
          const allPresences = Object.values(state).flat() as unknown[]
          const currentPresence = allPresences.find(
            (p: unknown): p is PresenceData =>
              typeof p === 'object' && p !== null && 'user_id' in p && (p as PresenceData).user_id === userId
          )

          if (currentPresence?.status === 'away') {
            updatePresence(userId, 'online')
          }
        }
      } catch {
        // Ignore errors when checking presence state
      }
    }

    // Reset idle timeout
    if (idleTimeout) {
      clearTimeout(idleTimeout)
      idleTimeout = null
    }

    // Set away after idle threshold
    idleTimeout = setTimeout(() => {
      updatePresence(userId, 'away')
    }, IDLE_THRESHOLD)
  }

  // Activity events to track
  const activityEvents = [
    'mousedown',
    'mousemove',
    'keypress',
    'scroll',
    'touchstart',
    'click',
  ] as const

  // Add event listeners
  activityEvents.forEach((event) => {
    document.addEventListener(event, handleActivity, { passive: true })
    activityListeners.push(() => {
      document.removeEventListener(event, handleActivity)
    })
  })

  // Initial idle timeout
  idleTimeout = setTimeout(() => {
    updatePresence(userId, 'away')
  }, IDLE_THRESHOLD)
}

/**
 * Initialize presence tracking for a user
 */
export const initializePresence = async (userId: string): Promise<void> => {
  try {
    presenceChannel = supabase.channel('presence', {
      config: {
        presence: {
          key: userId,
        },
      },
    })

    await presenceChannel
      .on('presence', { event: 'sync' }, () => {
        // Presence state synced
      })
      .on('presence', { event: 'join' }, () => {
        // User joined
      })
      .on('presence', { event: 'leave' }, () => {
        // User left
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && presenceChannel) {
          const timestamp = new Date().toISOString()

          await presenceChannel.track({
            user_id: userId,
            status: 'online',
            last_seen: timestamp,
            last_activity: timestamp,
          })

          await updateDatabasePresence(userId, 'online')
          startActivityTracking(userId)
        }
      })

    // Set up periodic heartbeat
    statusUpdateInterval = setInterval(async () => {
      const currentStatus = await getCurrentStatus(userId)
      if (currentStatus === 'online' && presenceChannel) {
        const timestamp = new Date().toISOString()
        await presenceChannel.track({
          user_id: userId,
          status: 'online',
          last_seen: timestamp,
          last_activity: new Date(lastActivityTime).toISOString(),
        })
      }
    }, HEARTBEAT_INTERVAL)
  } catch (error) {
    console.error('Failed to initialize presence:', error)
  }
}

/**
 * Update user presence status (both Realtime and database)
 */
export const updatePresence = async (
  userId: string,
  status: PresenceStatusType
): Promise<void> => {
  if (!presenceChannel) return

  try {
    const timestamp = new Date().toISOString()
    const activityTime =
      status === 'online' ? new Date(lastActivityTime).toISOString() : timestamp

    await presenceChannel.track({
      user_id: userId,
      status,
      last_seen: timestamp,
      last_activity: activityTime,
    })

    await updateDatabasePresence(userId, status)
  } catch (error) {
    console.error('Failed to update presence:', error)
  }
}

/**
 * Get online users from Realtime
 */
export const getOnlineUsers = async (): Promise<PresenceStatus[]> => {
  if (!presenceChannel) return []

  try {
    const state = presenceChannel.presenceState()
    return Object.values(state)
      .flat()
      .map((presence: unknown): PresenceStatus => {
        const p = presence as PresenceData
        return {
          id: p.user_id,
          status: p.status ?? 'offline',
          lastSeen: p.last_seen ?? new Date().toISOString(),
        }
      })
  } catch (error) {
    console.error('Failed to get online users:', error)
    return []
  }
}

/**
 * Get presence status for a user
 * Checks Realtime first, then calculates from last_seen
 */
export const getUserPresenceStatus = async (
  userId: string,
  lastSeen?: string | null
): Promise<PresenceStatusType> => {
  // Check Realtime presence first
  if (presenceChannel) {
    try {
      const state = presenceChannel.presenceState()
      if (state && typeof state === 'object') {
        const allPresences = Object.values(state).flat() as unknown[]
        const userPresence = allPresences.find(
          (p: unknown): p is PresenceData =>
            typeof p === 'object' && p !== null && 'user_id' in p && (p as PresenceData).user_id === userId
        )

        if (userPresence?.status) {
          return userPresence.status
        }
      }
    } catch {
      // Fall through to calculate from last_seen
    }
  }

  // Calculate from last_seen if not in Realtime
  if (lastSeen) {
    return calculateStatusFromLastSeen(lastSeen)
  }

  return 'offline'
}

/**
 * Internal handler for presence changes that notifies all callbacks
 */
const handlePresenceChange = (): void => {
  if (presenceCallbacks.size === 0) return

  try {
    const state = presenceChannel?.presenceState()
    if (!state || typeof state !== 'object') return

    Object.values(state)
      .flat()
      .forEach((presence: unknown) => {
        const p = presence as PresenceData
        if (p?.user_id) {
          const status =
            p.status ?? (p.last_seen ? calculateStatusFromLastSeen(p.last_seen) : 'offline')
          const lastSeen = p.last_seen ?? new Date().toISOString()

          // Notify all registered callbacks
          presenceCallbacks.forEach((callback) => {
            callback(p.user_id, status, lastSeen)
          })
        }
      })
  } catch (error) {
    console.error('Error handling presence change:', error)
  }
}

/**
 * Subscribe to presence changes for other users
 */
export const subscribeToPresenceChanges = (
  callback: PresenceChangeCallback
): (() => void) => {
  if (!presenceChannel) return () => {}

  // Add callback to set
  presenceCallbacks.add(callback)

  // If this is the first callback, set up event listeners
  if (presenceCallbacks.size === 1) {
    presenceChannel.on('presence', { event: 'sync' }, handlePresenceChange)
    presenceChannel.on('presence', { event: 'join' }, handlePresenceChange)
    presenceChannel.on('presence', { event: 'leave' }, handlePresenceChange)

    // Trigger initial sync
    setTimeout(handlePresenceChange, 1000)
  } else {
    // If listeners already set up, just trigger immediate sync
    setTimeout(handlePresenceChange, 100)
  }

  // Return unsubscribe function
  return () => {
    presenceCallbacks.delete(callback)
  }
}

/**
 * Set user as away (when tab becomes inactive)
 */
export const setAway = (userId: string): Promise<void> => {
  return updatePresence(userId, 'away')
}

/**
 * Set user as busy
 */
export const setBusy = (userId: string): Promise<void> => {
  return updatePresence(userId, 'busy')
}

/**
 * Clean up presence tracking
 */
export const cleanup = async (userId?: string): Promise<void> => {
  // Clear activity listeners
  activityListeners.forEach((removeListener) => removeListener())
  activityListeners.length = 0

  // Clear presence callbacks
  presenceCallbacks.clear()

  if (idleTimeout) {
    clearTimeout(idleTimeout)
    idleTimeout = null
  }

  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval)
    statusUpdateInterval = null
  }

  // Mark user as offline in database
  if (userId) {
    await updateDatabasePresence(userId, 'offline')
  }

  if (presenceChannel) {
    await presenceChannel.unsubscribe()
    presenceChannel = null
  }
}

/**
 * Presence service object for backward compatibility
 * Exports all methods as a single object
 */
export const presenceService = {
  initializePresence,
  updatePresence,
  getOnlineUsers,
  getUserPresenceStatus,
  subscribeToPresenceChanges,
  setAway,
  setBusy,
  cleanup,
  calculateStatusFromLastSeen,
} as const
