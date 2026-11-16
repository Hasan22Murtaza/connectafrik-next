import type { SupabaseClient } from '@supabase/supabase-js'
import { listLiveKitParticipantIdentities, deleteLiveKitRoom } from '@/lib/call-media/livekit'

/** Matches client + PATCH lifecycle */
export const ACTIVE_CALL_STATUSES = ['initiated', 'ringing', 'active'] as const

/** Align with client outgoing/incoming unanswered timeout (45s). */
export const RING_STALE_MS = 45_000
/**
 * Grace before treating an empty LiveKit room as abandoned while still ringing.
 * Long enough for the caller to connect after POST; short enough for immediate recall.
 */
export const EMPTY_RING_GRACE_MS = 8_000
/** Align with heartbeat reaper (90s). */
export const ACTIVE_HEARTBEAT_STALE_MS = 90_000

type BusySessionRow = {
  id: string
  call_id: string
  created_by: string
  participants: unknown
  metadata: unknown
  status: string
  updated_at: string | null
  started_at: string | null
  created_at: string | null
  room_id: string | null
  last_heartbeat_at: string | null
  duration_seconds?: number | null
}

function parseMeta(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {}
  return meta as Record<string, unknown>
}

function targetsFromMeta(meta: unknown): string[] {
  const m = parseMeta(meta)
  const out: string[] = []
  for (const k of ['targetUserId', 'target_user_id', 'lastInvitedUserId'] as const) {
    const v = m[k]
    if (typeof v === 'string' && v.trim()) out.push(v.trim())
  }
  // Mid-call Add People stamps invitees here on every sibling session that
  // shares the call_id — token auth must honor this or re-invites 403.
  if (Array.isArray(m.invitedUserIds)) {
    for (const id of m.invitedUserIds) {
      if (typeof id === 'string' && id.trim()) out.push(id.trim())
    }
  }
  return [...new Set(out)]
}

function normId(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function sessionAgeMs(row: {
  started_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}, nowMs: number): number {
  const raw = row.started_at || row.created_at || row.updated_at
  if (!raw) return Number.POSITIVE_INFINITY
  const ts = Date.parse(raw)
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY
  return Math.max(0, nowMs - ts)
}

function mergeSessionMetadata(existing: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  return { ...parseMeta(existing), ...patch }
}

/** True if the user created the call, is in participants, or was invited/targeted. */
export function userInvolvedInSession(
  row: { created_by: string; participants: unknown; metadata: unknown },
  userId: string,
): boolean {
  const uid = normId(userId)
  if (!uid) return false
  if (normId(row.created_by) === uid) return true
  const parts = row.participants
  if (Array.isArray(parts) && parts.some((p) => normId(p) === uid)) return true
  return targetsFromMeta(row.metadata).some((t) => normId(t) === uid)
}

/**
 * Pure busy decision for a single live row (after optional stale reaping).
 * Used by tests and getBusyMapForUserIds.
 */
export function isSessionBlockingBusy(row: {
  status: string
  started_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  last_heartbeat_at?: string | null
}, nowMs: number = Date.now()): boolean {
  const status = String(row.status || '')
  if (!ACTIVE_CALL_STATUSES.includes(status as (typeof ACTIVE_CALL_STATUSES)[number])) {
    return false
  }

  const age = sessionAgeMs(row, nowMs)

  if (status === 'ringing' || status === 'initiated') {
    // Past client ring timeout → should not block a new call (reaper / reclaim safety).
    if (age >= RING_STALE_MS) return false
    return true
  }

  // active
  const hbRaw = row.last_heartbeat_at
  if (hbRaw) {
    const hb = Date.parse(hbRaw)
    if (Number.isFinite(hb) && nowMs - hb >= ACTIVE_HEARTBEAT_STALE_MS) return false
    return true
  }
  // Never heartbeated: only treat as busy within the same window as the reaper.
  return age < ACTIVE_HEARTBEAT_STALE_MS
}

async function markSessionTerminal(
  serviceClient: SupabaseClient,
  row: BusySessionRow,
  status: 'missed' | 'ended',
  signal: string,
): Promise<void> {
  const now = new Date().toISOString()
  const started = row.started_at || row.created_at || now
  const duration = Math.max(0, Math.floor((Date.now() - Date.parse(started)) / 1000))
  await serviceClient
    .from('call_sessions')
    .update({
      status,
      ended_at: now,
      duration_seconds: Number.isFinite(duration) ? duration : row.duration_seconds,
      metadata: mergeSessionMetadata(row.metadata, {
        last_signal: signal,
        endedAt: now,
        reapedBy: 'busy_check',
      }),
      updated_at: now,
    })
    .eq('id', row.id)
    .in('status', [...ACTIVE_CALL_STATUSES])

  const roomId =
    (typeof row.room_id === 'string' && row.room_id.trim()) ||
    (typeof parseMeta(row.metadata).roomId === 'string'
      ? String(parseMeta(row.metadata).roomId).trim()
      : '')
  if (!roomId) return
  try {
    const identities = await listLiveKitParticipantIdentities(roomId)
    if (identities && identities.length === 0) {
      await deleteLiveKitRoom(roomId)
    }
  } catch {
    /* best-effort room cleanup */
  }
}

/**
 * End ringing/initiated/active ghost sessions that would falsely mark users busy.
 * Safe for genuine in-progress calls: occupied LiveKit rooms and fresh heartbeats stay live.
 */
export async function reapStaleSessionsBlockingUsers(
  serviceClient: SupabaseClient,
  userIds: string[],
  excludeCallId: string = '',
): Promise<number> {
  const ids = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return 0

  const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  const { data: rows, error } = await serviceClient
    .from('call_sessions')
    .select(
      'id, call_id, created_by, participants, metadata, status, updated_at, started_at, created_at, room_id, last_heartbeat_at, duration_seconds',
    )
    .in('status', [...ACTIVE_CALL_STATUSES])
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(400)

  if (error) throw new Error(error.message)

  const nowMs = Date.now()
  let reaped = 0

  for (const raw of rows || []) {
    const row = raw as BusySessionRow
    if (excludeCallId && row.call_id === excludeCallId) continue
    if (!ids.some((uid) => userInvolvedInSession(row, uid))) continue

    const status = String(row.status || '')
    const age = sessionAgeMs(row, nowMs)

    if (status === 'ringing' || status === 'initiated') {
      if (age >= RING_STALE_MS) {
        await markSessionTerminal(serviceClient, row, 'missed', 'busy_reap_ring_timeout')
        reaped += 1
        continue
      }
      if (age < EMPTY_RING_GRACE_MS) continue

      const roomId =
        (typeof row.room_id === 'string' && row.room_id.trim()) ||
        (typeof parseMeta(row.metadata).roomId === 'string'
          ? String(parseMeta(row.metadata).roomId).trim()
          : '')
      if (!roomId) {
        await markSessionTerminal(serviceClient, row, 'missed', 'busy_reap_empty')
        reaped += 1
        continue
      }
      const identities = await listLiveKitParticipantIdentities(roomId)
      // null = LiveKit unreachable — do not guess; leave for cron.
      if (identities === null) continue
      if (identities.length === 0) {
        await markSessionTerminal(serviceClient, row, 'missed', 'busy_reap_empty')
        reaped += 1
      }
      continue
    }

    if (status === 'active') {
      const hbRaw = row.last_heartbeat_at
      if (hbRaw) {
        const hb = Date.parse(hbRaw)
        if (Number.isFinite(hb) && nowMs - hb >= ACTIVE_HEARTBEAT_STALE_MS) {
          await markSessionTerminal(serviceClient, row, 'ended', 'busy_reap_heartbeat')
          reaped += 1
        }
      } else if (age >= ACTIVE_HEARTBEAT_STALE_MS) {
        await markSessionTerminal(serviceClient, row, 'ended', 'busy_reap_heartbeat')
        reaped += 1
      }
    }
  }

  return reaped
}

/**
 * For each user id, whether they appear in an active call_sessions row (optionally excluding one call_id).
 * Callers should run `reapStaleSessionsBlockingUsers` first when starting a new call.
 */
export async function getBusyMapForUserIds(
  serviceClient: SupabaseClient,
  userIds: string[],
  excludeCallId: string,
): Promise<Record<string, boolean>> {
  const busy: Record<string, boolean> = {}
  for (const id of userIds) busy[id] = false
  if (userIds.length === 0) return busy

  const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  const nowMs = Date.now()

  const { data: rows, error } = await serviceClient
    .from('call_sessions')
    .select(
      'call_id, created_by, participants, metadata, status, updated_at, started_at, created_at, last_heartbeat_at',
    )
    .in('status', [...ACTIVE_CALL_STATUSES])
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(400)

  if (error) throw new Error(error.message)

  for (const row of rows || []) {
    if (excludeCallId && row.call_id === excludeCallId) continue
    if (
      !isSessionBlockingBusy(
        {
          status: String(row.status || ''),
          started_at: row.started_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
          last_heartbeat_at: row.last_heartbeat_at,
        },
        nowMs,
      )
    ) {
      continue
    }
    for (const uid of userIds) {
      if (busy[uid]) continue
      if (
        userInvolvedInSession(
          row as { created_by: string; participants: unknown; metadata: unknown },
          uid,
        )
      ) {
        busy[uid] = true
      }
    }
  }

  return busy
}
