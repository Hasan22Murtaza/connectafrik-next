import { apiClient, ApiError } from '@/lib/api-client'

/** Lightweight message shape used by call signal subscribers (matches ChatMessage fields used by useVideoCall). */
export interface CallSignalMessage {
  id: string
  thread_id: string
  sender_id: string
  content: string
  created_at: string
  updated_at?: string
  message_type?: string
  metadata?: Record<string, unknown>
  read_by: string[]
  is_deleted?: boolean
}

/** Matches Postgres check constraint on call_sessions.status */
export const CALL_SESSION_STATUSES = [
  'initiated',
  'ringing',
  'active',
  'ended',
  'failed',
  'missed',
  'declined',
] as const

export type CallSessionStatus = (typeof CALL_SESSION_STATUSES)[number]

/** Status values that produce a subscriber UPDATE callback (terminal + active). */
const SESSION_UPDATE_MESSAGE_STATUSES = new Set<string>([
  'active',
  'declined',
  'ended',
  'missed',
  'failed',
])

function parseMeta(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  return {}
}

/** Build client call metadata (camelCase) from a call_sessions row */
export function callSessionRowToCallMetadata(row: Record<string, unknown>): Record<string, unknown> {
  const meta = parseMeta(row.metadata)
  const roomId = typeof row.room_id === 'string' ? row.room_id : ''
  const callId = typeof row.call_id === 'string' ? row.call_id : ''
  const callType = row.call_type === 'video' ? 'video' : 'audio'
  return {
    ...meta,
    roomId: meta.roomId || roomId,
    callId: meta.callId || callId,
    callType: meta.callType || callType,
    /** Surface DB status on metadata for consumers that only read metadata */
    sessionStatus: row.status,
  }
}

/**
 * Resolve canonical session status for UPDATE signaling: prefer call_sessions.status, then legacy last_signal.
 */
export function resolveSessionStatusFromRow(row: Record<string, unknown>): string | null {
  const status = String(row.status || '').trim()
  const meta = parseMeta(row.metadata)
  const ls = typeof meta.last_signal === 'string' ? meta.last_signal.trim() : ''

  if (['active', 'declined', 'ended', 'missed', 'failed'].includes(status)) {
    return status
  }

  if (ls) {
    if (['active', 'declined', 'ended', 'missed', 'failed'].includes(ls)) return ls
  }

  return null
}

/** Normalize chat message_type or signal string to call_sessions.status vocabulary. */
export function toCallSessionStatusMessageType(mt: string): string {
  if (!mt) return mt
  return mt
}

function senderIdForSessionStatus(
  sessionStatus: string,
  meta: Record<string, unknown>,
  createdBy: string
): string {
  if (sessionStatus === 'active' && meta.acceptedBy) return String(meta.acceptedBy)
  if (sessionStatus === 'declined' && meta.rejectedBy) return String(meta.rejectedBy)
  if (['ended', 'missed', 'failed'].includes(sessionStatus) && meta.endedBy) return String(meta.endedBy)
  return createdBy
}

function contentForSessionStatus(sessionStatus: string): string {
  switch (sessionStatus) {
    case 'active':
      return 'Call accepted'
    case 'declined':
      return 'Call rejected'
    case 'ended':
      return 'Call ended'
    case 'missed':
      return 'Missed call'
    case 'failed':
      return 'Call failed'
    default:
      return 'Call update'
  }
}

export function callSessionInsertToChatMessage(row: Record<string, unknown>): CallSignalMessage {
  const createdBy = String(row.created_by || '')
  const threadId = String(row.thread_id || '')
  const meta = callSessionRowToCallMetadata(row)
  const id = typeof row.id === 'string' ? row.id : String(row.id || '')
  const createdAt = typeof row.created_at === 'string' ? row.created_at : new Date().toISOString()
  const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : createdAt
  const status = String(row.status || 'ringing')
  const messageType = status === 'initiated' ? 'initiated' : 'ringing'

  return {
    id: `cs:${id}:ring`,
    thread_id: threadId,
    sender_id: createdBy,
    content: 'Incoming call',
    created_at: createdAt,
    updated_at: updatedAt,
    message_type: messageType,
    metadata: { ...meta, sessionStatus: status },
    read_by: [],
    is_deleted: false,
  }
}

/** Map a DB/API session row to a terminal signal for polling (prefers call_sessions.status). */
export function callSessionRowToPollTerminalMessage(row: Record<string, unknown>): CallSignalMessage | null {
  const status = String(row.status || '')
  const terminal = ['ended', 'declined', 'missed', 'failed']
  if (terminal.includes(status)) {
    return callSessionUpdateToChatMessage(row)
  }
  const meta = callSessionRowToCallMetadata(row)
  const ls = typeof meta.last_signal === 'string' ? meta.last_signal : ''
  const fromLegacy = ''
  if (fromLegacy && terminal.includes(fromLegacy)) {
    const synthetic = { ...row, status: fromLegacy, metadata: { ...meta, last_signal: ls } }
    return callSessionUpdateToChatMessage(synthetic)
  }
  return null
}

export function callSessionUpdateToChatMessage(
  row: Record<string, unknown>,
  oldRow?: Record<string, unknown>
): CallSignalMessage | null {
  const newStatus = String(row.status || '').trim()
  const oldStatus = oldRow ? String(oldRow.status || '').trim() : ''

  const meta = callSessionRowToCallMetadata(row)
  const sessionStatus = resolveSessionStatusFromRow(row)
  if (!sessionStatus || !SESSION_UPDATE_MESSAGE_STATUSES.has(sessionStatus)) {
    return null
  }

  // Avoid duplicate subscriber callbacks when only metadata changes but terminal status is unchanged.
  if (
    oldRow &&
    newStatus &&
    newStatus === oldStatus &&
    ['active', 'declined', 'ended', 'missed', 'failed'].includes(newStatus)
  ) {
    return null
  }

  const threadId = String(row.thread_id || '')
  const id = typeof row.id === 'string' ? row.id : String(row.id || '')
  const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString()
  const createdAt = typeof row.created_at === 'string' ? row.created_at : updatedAt
  const createdBy = String(row.created_by || '')

  const senderId = senderIdForSessionStatus(sessionStatus, meta, createdBy)

  return {
    id: `cs:${id}:${updatedAt}`,
    thread_id: threadId,
    sender_id: senderId,
    content: contentForSessionStatus(sessionStatus),
    created_at: createdAt,
    updated_at: updatedAt,
    message_type: sessionStatus,
    metadata: { ...meta, sessionStatus },
    read_by: [],
    is_deleted: false,
  }
}

/** PATCH call_sessions with short retries when the row is not visible yet (POST still in flight). */
export async function patchCallSessionWithRetry(
  threadId: string,
  payload: {
    call_id: string
    event: 'accept' | 'declined' | 'end' | 'missed'
    duration_seconds?: number
    /** Auth session row id (JWT `session_id`); included in accept/decline push payloads. */
    device_session_id?: string
  },
  options?: { maxAttempts?: number },
): Promise<boolean> {
  const maxAttempts = options?.maxAttempts ?? 5
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await apiClient.patch(`/api/chat/threads/${threadId}/call-sessions`, payload)
      return true
    } catch (e) {
      const st = e instanceof ApiError ? e.status : 0
      const canRetry = st === 404 && attempt < maxAttempts - 1
      if (!canRetry) {
        console.warn('[call_sessions] PATCH failed', { threadId, payload, status: st, e })
        return false
      }
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
    }
  }
  return false
}
