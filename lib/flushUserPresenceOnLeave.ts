'use client'

import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api-client'

/**
 * Clears profile `status` (sets null) and updates `last_seen` so other users
 * see "last seen …" immediately — not "Online" from a fresh timestamp.
 * Call before signOut or when tearing down the session.
 */
export async function flushUserPresenceOnLeave(): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) return
    const iso = new Date().toISOString()
    await apiClient.patch('/api/users/me', {
      status: null,
      last_seen: iso,
    })
  } catch {
    /* best-effort */
  }
}
