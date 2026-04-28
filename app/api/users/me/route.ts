import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
/** Client only uses `online` + `null` (left); keep legacy values for old rows / clients. */
const VALID_STATUSES = ['online', 'away', 'busy', 'offline'] as const

const PRESENCE_KEYS = new Set(['status', 'last_seen', 'last_active_at'])

type PresenceBody = {
  status?: string | null
  last_seen?: string
  last_active_at?: string
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * GET /api/users/me — full `profiles` row for the authenticated user (settings, marketplace bank fields, etc.).
 */
export async function GET(_request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(_request)
    const serviceClient = createServiceClient()

    const { data, error } = await serviceClient.from('profiles').select('*').eq('id', user.id).single()

    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('Profile not found', 404)

    return jsonResponse({ data })
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}

async function patchPresence(
  serviceClient: ReturnType<typeof createServiceClient>,
  userId: string,
  body: PresenceBody
) {
  const { status } = body
  const last_seen = body.last_seen
  const last_active_at = body.last_active_at

  if (status !== undefined && status !== null) {
    if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      return { error: errorResponse('Invalid status. Must be one of: online, away, busy, offline, or null', 400) }
    }
  }

  if (status === undefined && last_seen == null && last_active_at == null) {
    return { error: errorResponse('Provide at least one of: status, last_seen, last_active_at', 400) }
  }

  const updateData: Record<string, string | null> = {}

  if ('status' in body) {
    updateData.status = body.status === null ? null : (status as string)
  }
  if (last_active_at) updateData.last_active_at = last_active_at
  updateData.last_seen = last_seen || new Date().toISOString()

  const { data, error } = await serviceClient
    .from('profiles')
    .update(updateData)
    .eq('id', userId)
    .select('status, last_seen, last_active_at')
    .single()

  if (error) {
    return { error: errorResponse(error.message, 400) }
  }

  return {
    data: {
      status: data?.status,
      last_seen: data?.last_seen,
      last_active_at: data?.last_active_at,
    },
  }
}

/**
 * PATCH /api/users/me — presence (status, last_seen, last_active_at) and/or profile & marketplace fields.
 * Presence-only payloads are unchanged for heartbeats; other keys update `profiles` (same as /api/users/[id]).
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const raw = await request.json()
    if (!isPlainObject(raw)) {
      return errorResponse('Invalid JSON body', 400)
    }

    const presencePart: PresenceBody = {}
    const profilePart: Record<string, unknown> = {}

    for (const [key, val] of Object.entries(raw)) {
      if (PRESENCE_KEYS.has(key)) {
        ;(presencePart as Record<string, unknown>)[key] = val
      } else {
        profilePart[key] = val
      }
    }

    const hasPresence = Object.keys(presencePart).length > 0
    const hasProfile = Object.keys(profilePart).length > 0

    if (!hasPresence && !hasProfile) {
      return errorResponse('No updatable fields', 400)
    }

    let presenceJson: Record<string, unknown> | null = null

    if (hasPresence) {
      const pres = await patchPresence(serviceClient, user.id, presencePart)
      if (pres.error) return pres.error
      presenceJson = pres.data ?? null
    }

    if (hasProfile) {
      const updates: Record<string, unknown> = {
        ...profilePart,
        updated_at: new Date().toISOString(),
      }
      delete updates.id
      delete updates.created_at
      // Optional columns many DBs omit; UI uses structured fields + formattedAddress in client state.
      delete updates.location
      delete updates.region

      const { data: profile, error } = await supabase
        .from('profiles')
        .update(updates as never)
        .eq('id', user.id)
        .select('*')
        .single()

      if (error) {
        return errorResponse(error.message, 400)
      }

      return jsonResponse({ data: profile, presence: presenceJson })
    }

    return jsonResponse(presenceJson ?? {})
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
