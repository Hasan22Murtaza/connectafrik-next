import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

const CHANNEL = 'app-global-presence'

let channel: RealtimeChannel | null = null
let initUserId: string | null = null
const syncListeners = new Set<() => void>()

function notifyListeners(): void {
  syncListeners.forEach((fn) => {
    try {
      fn()
    } catch {
      /* empty */
    }
  })
}

/**
 * All user IDs currently in this Supabase Presence channel (best-effort).
 */
export function getPresentUserIds(): Set<string> {
  const ids = new Set<string>()
  if (!channel) return ids
  try {
    const state = channel.presenceState()
    const flat = Object.values(state).flat() as unknown[]
    for (const p of flat) {
      if (p && typeof p === 'object' && 'user_id' in p && typeof (p as { user_id: string }).user_id === 'string') {
        ids.add((p as { user_id: string }).user_id)
      }
    }
  } catch {
    /* empty */
  }
  return ids
}

/**
 * Call when a consumer needs presence updates (ChatWindow, etc.).
 */
export function subscribeChatPresenceSync(onSync: () => void): () => void {
  syncListeners.add(onSync)
  return () => {
    syncListeners.delete(onSync)
  }
}

/**
 * Join the global channel and track this user so others see them in Realtime.
 */
export async function initChatPresenceRealtime(userId: string): Promise<void> {
  if (channel && initUserId === userId) {
    await trackPresence(userId)
    return
  }
  await cleanupChatPresenceRealtime()

  initUserId = userId
  channel = supabase.channel(CHANNEL, {
    config: {
      presence: {
        key: userId,
      },
    },
  })

  channel
    .on('presence', { event: 'sync' }, notifyListeners)
    .on('presence', { event: 'join' }, notifyListeners)
    .on('presence', { event: 'leave' }, notifyListeners)

  await new Promise<void>((resolve, reject) => {
    if (!channel) {
      reject(new Error('no channel'))
      return
    }
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && channel) {
        try {
          await trackPresence(userId)
          notifyListeners()
          resolve()
        } catch (e) {
          reject(e)
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error(String(status)))
      }
    })
  })
}

export async function trackPresence(userId: string): Promise<void> {
  if (!channel || initUserId !== userId) return
  const iso = new Date().toISOString()
  await channel.track({
    user_id: userId,
    online: true,
    at: iso,
  })
  notifyListeners()
}

export async function cleanupChatPresenceRealtime(): Promise<void> {
  if (channel) {
    try {
      await channel.unsubscribe()
    } catch {
      /* empty */
    }
    channel = null
  }
  initUserId = null
  notifyListeners()
}
