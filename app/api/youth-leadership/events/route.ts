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

const EVENT_LIST_SELECT = `
  id, title, description, event_type, format, start_at, end_at, status,
  capacity, organization_id, location_region, access_info, created_by, created_at,
  organization:youth_organizations!organization_id(id, name, logo_url)
`

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const { searchParams } = new URL(request.url)
    const upcoming = searchParams.get('upcoming') !== '0'
    const orgId = searchParams.get('organization_id')
    const programId = searchParams.get('program_id')
    const projectId = searchParams.get('project_id')
    const status = searchParams.get('status')
    const eventType = searchParams.get('event_type')
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '40', 10) || 40, 1),
      50
    )
    const from = page * limit
    const to = from + limit - 1

    let query = supabase
      .from('youth_events')
      .select(EVENT_LIST_SELECT)
      .order('start_at', { ascending: true })
      .range(from, to)

    if (orgId) {
      const authz = await requireOrgRole(supabase, orgId, user.id, 'viewer')
      if (!authz.ok) {
        query = query.eq('organization_id', orgId).in('status', [
          'scheduled',
          'ongoing',
          'completed',
        ])
      } else {
        query = query.eq('organization_id', orgId)
        if (status) query = query.eq('status', status)
      }
    } else if (!status) {
      // Full list: include completed; upcoming-only stays active statuses
      query = query.in(
        'status',
        upcoming ? ['scheduled', 'ongoing'] : ['scheduled', 'ongoing', 'completed']
      )
    } else {
      query = query.eq('status', status)
    }

    if (programId) query = query.eq('program_id', programId)
    if (projectId) query = query.eq('project_id', projectId)
    if (eventType) query = query.eq('event_type', eventType)

    if (upcoming) {
      query = query.gte('start_at', new Date().toISOString())
    }

    const { data, error } = await query
    if (error) return errorResponse(error.message, 400)

    const events = data || []
    const ids = events.map((e) => e.id)
    let myAttendance = new Map<string, any>()
    let counts = new Map<string, number>()

    if (ids.length > 0) {
      const [{ data: attendance }, { data: mine }] = await Promise.all([
        supabase
          .from('youth_event_attendance')
          .select('event_id')
          .in('event_id', ids)
          .in('attendance_status', ['registered', 'attended']),
        supabase
          .from('youth_event_attendance')
          .select('id, event_id, user_id, attendance_status')
          .eq('user_id', user.id)
          .in('event_id', ids),
      ])
      for (const a of attendance || []) {
        counts.set(a.event_id, (counts.get(a.event_id) || 0) + 1)
      }
      for (const a of mine || []) myAttendance.set(a.event_id, a)
    }

    return jsonResponse(
      events.map((e) => ({
        ...e,
        attendance_count: counts.get(e.id) || 0,
        my_attendance: myAttendance.get(e.id) || null,
      }))
    )
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load events', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const body = await request.json()
    if (!body.title?.trim()) return errorResponse('title is required', 400)
    if (!body.start_at) return errorResponse('start_at is required', 400)

    const organizationId = body.organization_id ?? null
    if (organizationId) {
      const authz = await requireOrgRole(supabase, organizationId, user.id, 'coordinator')
      if (!authz.ok) return forbiddenResponse(authz.message)
    } else {
      return errorResponse('organization_id is required to create events.', 400)
    }

    const payload = {
      organization_id: organizationId,
      program_id: body.program_id ?? null,
      project_id: body.project_id ?? null,
      group_event_id: body.group_event_id ?? null,
      title: String(body.title).trim(),
      description: body.description ?? null,
      event_type: body.event_type || 'workshop',
      start_at: body.start_at,
      end_at: body.end_at ?? null,
      format: body.format || 'online',
      location_region: body.location_region ?? null,
      access_info: body.access_info ?? null,
      capacity: body.capacity ?? null,
      status: body.status === 'draft' ? 'draft' : 'scheduled',
      created_by: user.id,
    }

    const { data, error } = await supabase
      .from('youth_events')
      .insert(payload)
      .select(EVENT_LIST_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create event', 500)
  }
}
