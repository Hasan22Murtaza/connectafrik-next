import type { SupabaseClient } from '@supabase/supabase-js'

/** Matches client + PATCH lifecycle */
const ACTIVE_STATUSES = ['initiated', 'ringing', 'active'] as const

function parseMeta(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {}
  return meta as Record<string, unknown>
}

function targetsFromMeta(meta: unknown): string[] {
  const m = parseMeta(meta)
  const out: string[] = []
  for (const k of ['targetUserId', 'target_user_id'] as const) {
    const v = m[k]
    if (typeof v === 'string' && v.trim()) out.push(v.trim())
  }
  return out
}

function userInvolvedInSession(
  row: { created_by: string; participants: unknown; metadata: unknown },
  userId: string,
): boolean {
  if (row.created_by === userId) return true
  const parts = row.participants
  if (Array.isArray(parts) && parts.includes(userId)) return true
  return targetsFromMeta(row.metadata).includes(userId)
}

/**
 * For each user id, whether they appear in an active call_sessions row (optionally excluding one call_id).
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

  const { data: rows, error } = await serviceClient
    .from('call_sessions')
    .select('call_id, created_by, participants, metadata, status, updated_at')
    .in('status', [...ACTIVE_STATUSES])
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(400)

  if (error) throw new Error(error.message)

  for (const row of rows || []) {
    if (excludeCallId && row.call_id === excludeCallId) continue
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
