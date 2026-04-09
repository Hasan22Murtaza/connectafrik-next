import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

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
 * POST: which users are tied to an in-flight call session (another call).
 * Optional `exclude_call_id`: same logical call (e.g. group add) is not counted as "busy elsewhere".
 */
export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))
    const rawIds = body.user_ids
    const user_ids = Array.isArray(rawIds)
      ? [
          ...new Set(
            rawIds
              .filter((x: unknown): x is string => typeof x === 'string' && Boolean(x.trim()))
              .map((x: string) => x.trim()),
          ),
        ]
      : []
    const exclude_call_id =
      typeof body.exclude_call_id === 'string' ? body.exclude_call_id.trim() : ''

    if (user_ids.length === 0) {
      return jsonResponse<{ busy: Record<string, boolean> }>({ busy: {} })
    }
    if (user_ids.length > 50) {
      return errorResponse('Too many user_ids (max 50)', 400)
    }

    const serviceClient = createServiceClient()
    const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()

    const { data: rows, error } = await serviceClient
      .from('call_sessions')
      .select('call_id, created_by, participants, metadata, status, updated_at')
      .in('status', [...ACTIVE_STATUSES])
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(400)

    if (error) return errorResponse(error.message, 400)

    const busy: Record<string, boolean> = {}
    for (const id of user_ids) busy[id] = false

    for (const row of rows || []) {
      if (exclude_call_id && row.call_id === exclude_call_id) continue
      for (const uid of user_ids) {
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

    return jsonResponse<{ busy: Record<string, boolean> }>({ busy })
  } catch (e: any) {
    if (e.message === 'Unauthorized' || e.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(e.message || 'Failed to check call status', 500)
  }
}
