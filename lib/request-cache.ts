/**
 * In-flight dedupe + short TTL cache for identical GET URLs.
 * Prevents multi-mount hooks from hammering the same endpoints.
 */

type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const inflight = new Map<string, Promise<unknown>>()
const cache = new Map<string, CacheEntry<unknown>>()

/** Endpoints safe to briefly cache client-side (seconds). */
const TTL_RULES: Array<{ test: (path: string) => boolean; ttlMs: number }> = [
  { test: (p) => p === '/api/users/me', ttlMs: 30_000 },
  { test: (p) => p === '/api/chat/unread-count', ttlMs: 5_000 },
  { test: (p) => p === '/api/chat/calls/missed-count', ttlMs: 5_000 },
  { test: (p) => p === '/api/friends/requests/count', ttlMs: 10_000 },
  { test: (p) => p === '/api/notifications/unread-count', ttlMs: 5_000 },
  { test: (p) => p === '/api/friends/suggestions', ttlMs: 60_000 },
  { test: (p) => p === '/api/friends', ttlMs: 30_000 },
  { test: (p) => p === '/api/users/members', ttlMs: 60_000 },
  { test: (p) => p === '/api/family/me', ttlMs: 20_000 },
  // Collapse bursty call-session GETs from ChatWindow + MeetingContainer + context.
  { test: (p) => p.includes('/call-sessions'), ttlMs: 2_500 },
  // Youth Leadership: dedupe remounts / parallel panels hitting the same lists
  { test: (p) => p === '/api/youth-leadership/organizations', ttlMs: 30_000 },
  { test: (p) => p === '/api/youth-leadership/categories', ttlMs: 60_000 },
  { test: (p) => p === '/api/youth-leadership/guardian', ttlMs: 15_000 },
  { test: (p) => p === '/api/youth-leadership/dashboard', ttlMs: 15_000 },
  {
    test: (p) =>
      p === '/api/youth-leadership/mentors' ||
      p.startsWith('/api/youth-leadership/mentors?'),
    ttlMs: 10_000,
  },
]

function resolveTtl(url: string): number {
  try {
    const path = new URL(url, 'http://local').pathname
    for (const rule of TTL_RULES) {
      if (rule.test(path)) return rule.ttlMs
    }
  } catch {
    /* ignore */
  }
  return 0
}

export function invalidateRequestCache(matcher?: string | RegExp): void {
  if (!matcher) {
    cache.clear()
    return
  }
  for (const key of cache.keys()) {
    const hit =
      typeof matcher === 'string' ? key.includes(matcher) : matcher.test(key)
    if (hit) cache.delete(key)
  }
}

export async function cachedGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttlMs?: number; signal?: AbortSignal }
): Promise<T> {
  if (options?.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const ttlMs = options?.ttlMs ?? resolveTtl(key)
  const cached = cache.get(key) as CacheEntry<T> | undefined
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const existing = inflight.get(key) as Promise<T> | undefined
  if (existing) return existing

  const promise = fetcher()
    .then((value) => {
      if (ttlMs > 0) {
        cache.set(key, { value, expiresAt: Date.now() + ttlMs })
      }
      return value
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, promise)
  return promise
}
