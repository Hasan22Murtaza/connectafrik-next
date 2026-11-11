import type { Session } from '@supabase/supabase-js'

/**
 * In-memory auth session cache.
 *
 * `apiClient` and other hot paths used to call `supabase.auth.getSession()` on
 * every request. With `@supabase/ssr` createBrowserClient that can fan out into
 * repeated `GET /auth/v1/user` calls (visible in DevTools as many "user" rows).
 *
 * AuthProvider seeds this cache once; we only fall back to getSession on miss
 * or near-expiry, and concurrent misses share one in-flight promise.
 */

let accessToken: string | null = null
/** Unix seconds (Supabase session.expires_at). */
let expiresAtSec: number | null = null
let userId: string | null = null
let inflight: Promise<string | null> | null = null
let listenerBound = false

const EXPIRY_SKEW_MS = 60_000

export function setCachedAuthSession(session: Session | null | undefined): void {
  accessToken = session?.access_token ?? null
  expiresAtSec = typeof session?.expires_at === 'number' ? session.expires_at : null
  userId = session?.user?.id ?? null
}

export function clearCachedAuthSession(): void {
  accessToken = null
  expiresAtSec = null
  userId = null
  inflight = null
}

function isTokenFresh(token: string | null): token is string {
  if (!token) return false
  if (!expiresAtSec) return true
  return expiresAtSec * 1000 - Date.now() > EXPIRY_SKEW_MS
}

/** Sync read for keepalive / beacon paths. */
export function getCachedAccessTokenSync(): string | null {
  return isTokenFresh(accessToken) ? accessToken : null
}

export function getCachedUserIdSync(): string | null {
  return userId
}

/**
 * Prefer memory; on miss/near-expiry, one shared getSession().
 * Does not call getUser() (that always hits /auth/v1/user).
 */
export async function getAccessToken(): Promise<string | null> {
  if (isTokenFresh(accessToken)) return accessToken

  if (inflight) return inflight

  inflight = (async () => {
    const { supabase } = await import('@/lib/supabase')
    const {
      data: { session },
    } = await supabase.auth.getSession()
    setCachedAuthSession(session)
    return session?.access_token ?? null
  })()
    .catch(() => {
      clearCachedAuthSession()
      return null
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

/** Bind a single onAuthStateChange writer (safe to call multiple times). */
export function ensureAuthSessionCacheListener(): void {
  if (typeof window === 'undefined' || listenerBound) return
  listenerBound = true
  void import('@/lib/supabase').then(({ supabase }) => {
    supabase.auth.onAuthStateChange((_event, session) => {
      setCachedAuthSession(session)
    })
  })
}
