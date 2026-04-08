import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { deviceLabelFromUserAgent } from '@/shared/utils/sessionDeviceLabel'

type AuthSessionRow = {
  id: string
  user_agent: string | null
  ip: string | null
  created_at: string
  updated_at: string
  refreshed_at: string | null
}

function parseSessionRows(data: unknown): AuthSessionRow[] {
  if (Array.isArray(data)) return data as AuthSessionRow[]
  if (data == null) return []
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown
      return Array.isArray(parsed) ? (parsed as AuthSessionRow[]) : []
    } catch {
      return []
    }
  }
  return []
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const { data, error } = await serviceClient.rpc('list_user_auth_sessions', {
      p_user_id: user.id,
    })

    if (error) {
      return errorResponse(error.message || 'Failed to load sessions', 500)
    }

    const rows = parseSessionRows(data)

    const ids = rows.map((r) => r.id)
    const labelById = new Map<string, string>()
    if (ids.length > 0) {
      const { data: labelRows, error: labelErr } = await serviceClient
        .from('auth_session_device_labels')
        .select('session_id, device_label')
        .eq('user_id', user.id)
        .in('session_id', ids)

      if (!labelErr && labelRows) {
        for (const r of labelRows) {
          if (r.session_id && r.device_label) labelById.set(String(r.session_id), String(r.device_label))
        }
      }
    }

    const sessions = rows.map((row) => {
      const fromDb = labelById.get(row.id)
      const fromUa = deviceLabelFromUserAgent(row.user_agent)
      let device_label =
        fromDb ||
        (fromUa.includes('Unknown platform')
          ? 'Another browser or app'
          : fromUa)

      return {
        id: row.id,
        device_label,
        ip: row.ip,
        user_agent: row.user_agent,
        created_at: row.created_at,
        updated_at: row.updated_at,
        refreshed_at: row.refreshed_at,
        last_active_at: row.refreshed_at || row.updated_at || row.created_at,
      }
    })

    return jsonResponse({
      sessions,
      count: sessions.length,
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorizedResponse()
    const message = err instanceof Error ? err.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
