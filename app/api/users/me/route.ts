import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

/** Client only uses `online` + `null` (left); keep legacy values for old rows / clients. */
const VALID_STATUSES = ['online', 'away', 'busy', 'offline'] as const

type PresenceBody = {
  /** Set to `null` when the user leaves / logs out so UI shows last_seen, not "online". */
  status?: string | null
  last_seen?: string
  last_active_at?: string
}

/**
 * PATCH /api/users/me — update current user profile fields used for presence (status, last_seen, last_active_at).
 * Called when the app opens (online), on heartbeats, and when the tab closes (offline + last_seen).
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = (await request.json()) as PresenceBody

    const { status } = body
    const last_seen = body.last_seen
    const last_active_at = body.last_active_at

    if (status !== undefined && status !== null) {
      if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
        return errorResponse('Invalid status. Must be one of: online, away, busy, offline, or null', 400)
      }
    }

    if (status === undefined && last_seen == null && last_active_at == null) {
      return errorResponse('Provide at least one of: status, last_seen, last_active_at', 400)
    }

    const updateData: Record<string, string | null> = {}

    if ('status' in body) {
      updateData.status = body.status === null ? null : (status as string)
    }
    if (last_active_at) updateData.last_active_at = last_active_at
    // WhatsApp-style "last seen" is stored on every touch; same as /api/users/me/presence
    updateData.last_seen = last_seen || new Date().toISOString()

    const { data, error } = await serviceClient
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select('status, last_seen, last_active_at')
      .single()

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({
      status: data?.status,
      last_seen: data?.last_seen,
      last_active_at: data?.last_active_at,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
