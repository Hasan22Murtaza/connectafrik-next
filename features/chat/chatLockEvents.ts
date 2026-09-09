export const CHAT_LOCKED_CODE = 'CHAT_LOCKED'
export const CHAT_LOCK_TOKEN_HEADER = 'X-Chat-Lock-Token'
export const CHAT_LOCK_CHANGED_EVENT = 'chatThreadLockChanged'
export const CHAT_LOCK_SESSION_ENDED_EVENT = 'chatLockSessionEnded'
export const CHAT_LOCK_STATUS_CHANGED_EVENT = 'chatLockStatusChanged'

export const CHAT_LOCK_BACKGROUND_MS = 60_000

const CHAT_THREAD_API_ID =
  /\/api\/chat\/threads\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/i

export function chatThreadIdFromApiEndpoint(endpoint?: string): string | null {
  if (!endpoint) return null
  const match = endpoint.match(CHAT_THREAD_API_ID)
  return match?.[1] ?? null
}
