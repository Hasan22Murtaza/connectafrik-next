import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { writeGschAuditLog } from '@/lib/gsch/auth'
import { notifyGschOrgOwners } from '@/lib/gsch/notify'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const { data: event, error: eventError } = await supabase
      .from('gsch_events')
      .select('id, title, organization_id, is_published')
      .eq('id', id)
      .maybeSingle()
    if (eventError) return errorResponse(eventError.message, 400)
    if (!event) return errorResponse('Event not found', 404)
    if (!event.is_published) {
      return errorResponse('Event is not published', 400)
    }

    const { data: existing } = await supabase
      .from('gsch_event_registrations')
      .select('id, status')
      .eq('event_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    const cancel = body.cancel === true || body.toggle === true

    if (existing && existing.status === 'registered' && (cancel || body.toggle)) {
      const { data, error } = await supabase
        .from('gsch_event_registrations')
        .update({ status: 'cancelled' })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) return errorResponse(error.message, 400)

      await writeGschAuditLog(supabase, {
        actor_id: user.id,
        action: 'event_registration_cancelled',
        entity_type: 'gsch_event',
        entity_id: id,
      })

      return jsonResponse({ ...data, registered: false })
    }

    if (existing && existing.status === 'cancelled') {
      const { data, error } = await supabase
        .from('gsch_event_registrations')
        .update({
          status: 'registered',
          organization_id: body.organization_id || null,
        })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) return errorResponse(error.message, 400)

      await notifyGschOrgOwners(supabase, event.organization_id, {
        type: 'gsch_event_registration',
        title: 'Event registration',
        message: `Someone registered for "${event.title}".`,
        data: { event_id: id, registration_id: data.id },
        excludeUserId: user.id,
      })

      return jsonResponse({ ...data, registered: true })
    }

    if (existing && existing.status === 'registered') {
      return jsonResponse({ ...existing, registered: true })
    }

    const { data, error } = await supabase
      .from('gsch_event_registrations')
      .insert({
        event_id: id,
        user_id: user.id,
        organization_id: body.organization_id || null,
        status: 'registered',
      })
      .select('*')
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'event_registered',
      entity_type: 'gsch_event',
      entity_id: id,
    })

    await notifyGschOrgOwners(supabase, event.organization_id, {
      type: 'gsch_event_registration',
      title: 'Event registration',
      message: `Someone registered for "${event.title}".`,
      data: { event_id: id, registration_id: data.id },
      excludeUserId: user.id,
    })

    return jsonResponse({ ...data, registered: true }, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to register', 500)
  }
}
