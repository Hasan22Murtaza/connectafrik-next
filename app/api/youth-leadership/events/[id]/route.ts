import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import {
  checkYouthLeadershipAccess,
  requireOrgRole,
} from '@/lib/youth-leadership/auth'

const EVENT_SELECT = `
  *,
  organization:youth_organizations!organization_id(id, name, logo_url)
`

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const { data: event, error } = await supabase
      .from('youth_events')
      .select(EVENT_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (error) return errorResponse(error.message, 400)
    if (!event) return errorResponse('Event not found', 404)

    const [{ data: myAttendance }, { count }] = await Promise.all([
      supabase
        .from('youth_event_attendance')
        .select('*')
        .eq('event_id', id)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('youth_event_attendance')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', id)
        .in('attendance_status', ['registered', 'attended']),
    ])

    return jsonResponse({
      ...event,
      attendance_count: count ?? 0,
      my_attendance: myAttendance || null,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load event', 500)
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const { data: existing } = await supabase
      .from('youth_events')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!existing) return errorResponse('Event not found', 404)

    const isCreator = existing.created_by === user.id
    let isCoordinator = false
    if (existing.organization_id) {
      const authz = await requireOrgRole(
        supabase,
        existing.organization_id,
        user.id,
        'coordinator'
      )
      isCoordinator = authz.ok
    }

    if (!isCreator && !isCoordinator) {
      return forbiddenResponse('Not authorized to update this event.')
    }

    const allowed: Record<string, unknown> = {}
    for (const key of [
      'title',
      'description',
      'event_type',
      'start_at',
      'end_at',
      'format',
      'location_region',
      'access_info',
      'capacity',
      'status',
      'program_id',
      'project_id',
    ] as const) {
      if (body[key] !== undefined) allowed[key] = body[key]
    }

    if (Object.keys(allowed).length === 0) {
      return errorResponse('No valid updates provided.', 400)
    }

    const { data, error } = await supabase
      .from('youth_events')
      .update(allowed)
      .eq('id', id)
      .select(EVENT_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update event', 500)
  }
}
