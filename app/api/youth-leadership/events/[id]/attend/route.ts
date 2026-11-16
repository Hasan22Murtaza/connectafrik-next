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
import type { YouthAttendanceStatus } from '@/shared/types/youthLeadership'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: eventId } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const body = await request.json().catch(() => ({}))
    const action = (body.action || 'register') as 'register' | 'cancel'

    const { data: event } = await supabase
      .from('youth_events')
      .select('id, status, capacity, created_by, organization_id, title')
      .eq('id', eventId)
      .maybeSingle()

    if (!event) return errorResponse('Event not found', 404)
    if (!['scheduled', 'ongoing'].includes(event.status) && action === 'register') {
      return errorResponse('This event is not open for registration.', 400)
    }

    const { data: existing } = await supabase
      .from('youth_event_attendance')
      .select('id, event_id, user_id, attendance_status')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (action === 'cancel') {
      if (!existing) return errorResponse('You are not registered for this event.', 400)
      const { data, error } = await supabase
        .from('youth_event_attendance')
        .update({ attendance_status: 'cancelled' })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) return errorResponse(error.message, 400)
      return jsonResponse(data)
    }

    if (event.capacity != null) {
      const { count } = await supabase
        .from('youth_event_attendance')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .in('attendance_status', ['registered', 'attended'])
      const alreadyCounted =
        existing && ['registered', 'attended'].includes(existing.attendance_status)
      if (!alreadyCounted && (count || 0) >= event.capacity) {
        return errorResponse('This event is at capacity.', 400)
      }
    }

    if (existing) {
      const { data, error } = await supabase
        .from('youth_event_attendance')
        .update({ attendance_status: 'registered' })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) return errorResponse(error.message, 400)
      return jsonResponse(data)
    }

    const { data, error } = await supabase
      .from('youth_event_attendance')
      .insert({
        event_id: eventId,
        user_id: user.id,
        attendance_status: 'registered',
      })
      .select('*')
      .single()

    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update attendance', 500)
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id: eventId } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const { data: event } = await supabase
      .from('youth_events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle()

    if (!event) return errorResponse('Event not found', 404)

    const isCreator = event.created_by === user.id
    let isCoordinator = false
    if (event.organization_id) {
      const authz = await requireOrgRole(
        supabase,
        event.organization_id,
        user.id,
        'coordinator'
      )
      isCoordinator = authz.ok
    }

    if (!isCreator && !isCoordinator) {
      return forbiddenResponse('Only coordinators can verify attendance.')
    }

    const targetUserId = body.user_id as string
    const attendanceStatus = body.attendance_status as YouthAttendanceStatus
    if (!targetUserId || !attendanceStatus) {
      return errorResponse('user_id and attendance_status are required', 400)
    }
    if (!['attended', 'absent', 'registered', 'cancelled'].includes(attendanceStatus)) {
      return errorResponse('Invalid attendance_status', 400)
    }

    const { data: existing } = await supabase
      .from('youth_event_attendance')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', targetUserId)
      .maybeSingle()

    const patch = {
      attendance_status: attendanceStatus,
      verified_by: user.id,
      verified_at: new Date().toISOString(),
    }

    if (existing) {
      const { data, error } = await supabase
        .from('youth_event_attendance')
        .update(patch)
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) return errorResponse(error.message, 400)
      return jsonResponse(data)
    }

    const { data, error } = await supabase
      .from('youth_event_attendance')
      .insert({
        event_id: eventId,
        user_id: targetUserId,
        ...patch,
      })
      .select('*')
      .single()

    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to verify attendance', 500)
  }
}
