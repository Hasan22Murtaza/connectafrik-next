'use client'

import { apiClient } from '@/lib/api-client'
import { getAccessToken } from '@/lib/auth-session-cache'

/**
 * Clears profile `status` (sets null) and updates `last_seen` so other users
 * see "last seen …" immediately — not "Online" from a fresh timestamp.
 * Call before signOut or when tearing down the session.
 */
export async function flushUserPresenceOnLeave(): Promise<void> {
  try {
    const token = await getAccessToken()
    if (!token) return
    const iso = new Date().toISOString()
    await apiClient.patch('/api/users/me', {
      status: null,
      last_seen: iso,
    })
  } catch {
    /* best-effort */
  }
}
