/**
 * Server-only rollout switch. Never prefix this with NEXT_PUBLIC_.
 *
 *   MESSAGE_E2EE=off
 *   MESSAGE_E2EE=<user uuid>[,<user uuid>...]
 *   MESSAGE_E2EE=all
 *
 * Empty and "off" keep the existing thread-key message encoding.
 */
export type MessageE2eeFlag =
  | { mode: 'off' }
  | { mode: 'all' }
  | { mode: 'allowlist'; ids: Set<string> }

export function parseMessageE2eeFlag(raw: string | undefined | null): MessageE2eeFlag {
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

export function isMessageE2eeEnabledForUser(userId: string, raw = process.env.MESSAGE_E2EE): boolean {
  const flag = parseMessageE2eeFlag(raw)
  if (flag.mode === 'off') return false
  if (flag.mode === 'all') return true
  return flag.ids.has(userId.trim().toLowerCase())
}
