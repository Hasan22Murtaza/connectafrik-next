/**
 * Lightweight in-process rate limits for linking APIs.
 * Suitable for single-node Next deployments; not a shared cluster store.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function assertRateLimit(params: {
  key: string
  limit: number
  windowMs: number
}): void {
  const now = Date.now()
  const existing = buckets.get(params.key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(params.key, { count: 1, resetAt: now + params.windowMs })
    return
  }
  if (existing.count >= params.limit) {
    const err = new Error('RATE_LIMITED')
    throw err
  }
  existing.count += 1
}

/** Test helper */
export function clearRateLimits() {
  buckets.clear()
}
