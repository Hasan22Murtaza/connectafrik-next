/**
 * Server-only rollout switch. Never prefix this with NEXT_PUBLIC_.
 *
 *   CALL_E2EE=off
 *   CALL_E2EE=<user uuid>[,<user uuid>...]
 *   CALL_E2EE=all
 *
 * Empty and "off" leave the existing shared-key call path in place.
 * An allow-list or "all" seals the LiveKit media key to participant devices.
 */
export type CallE2eeFlag =
  | { mode: 'off' }
  | { mode: 'all' }
  | { mode: 'allowlist'; ids: Set<string> }

export function parseCallE2eeFlag(raw: string | undefined | null): CallE2eeFlag {
  const value = (raw ?? '').trim()
  if (!value || /^(off|false|0|disabled)$/i.test(value)) return { mode: 'off' }
  if (/^(all|on|true|1)$/i.test(value)) return { mode: 'all' }
  const ids = new Set(
    value
      .split(/[\s,]+/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  )
  if (ids.size === 0) return { mode: 'off' }
  return { mode: 'allowlist', ids }
}

export function isCallE2eeEnabledForUser(userId: string, raw = process.env.CALL_E2EE): boolean {
  const flag = parseCallE2eeFlag(raw)
  if (flag.mode === 'off') return false
  if (flag.mode === 'all') return true
  return flag.ids.has(userId.trim().toLowerCase())
}
