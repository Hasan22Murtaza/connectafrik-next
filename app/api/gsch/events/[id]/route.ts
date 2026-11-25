import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { GSCH_EVENT_SELECT, parseGschTags } from '@/lib/gsch/selects'
import { notifyGschOrgOwners } from '@/lib/gsch/notify'
import type { GschEventType } from '@/shared/types/gsch'

const EVENT_TYPES: GschEventType[] = [
  'conference',
  'trade_mission',
  'workshop',
  'summit',
  'cultural',
  'networking',
  'other',
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const { data, error } = await supabase
      .from('gsch_events')
      .select(GSCH_EVENT_SELECT)
      .eq('id', id)
      .maybeSingle()
    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('Event not found', 404)

    const { data: reg } = await supabase
      .from('gsch_event_registrations')
      .select('id, status')
      .eq('event_id', id)
      .eq('user_id', user.id)
      .eq('status', 'registered')
      .maybeSingle()

    return jsonResponse({
      ...data,
      is_registered: Boolean(reg),
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load event', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const body = await request.json()

    const { data: existing, error: loadError } = await supabase
      .from('gsch_events')
      .select('id, organization_id, is_published, title')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Event not found', 404)

    const authz = await requireOrgRole(
      supabase,
      existing.organization_id,
      user.id,
      'representative'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const patch: Record<string, unknown> = {}
    if (body.title != null) patch.title = String(body.title).trim()
    if (body.summary != null) patch.summary = body.summary?.trim() || null
    if (body.description != null) {
      patch.description = body.description?.trim() || null
    }
    if (body.event_type != null) {
      if (!EVENT_TYPES.includes(body.event_type)) {
        return errorResponse('Invalid event_type', 400)
      }
      patch.event_type = body.event_type
    }
    if (body.country != null) patch.country = body.country?.trim() || null
    if (body.continent != null) patch.continent = body.continent?.trim() || null
    if (body.location_label != null) {
      patch.location_label = body.location_label?.trim() || null
    }
    if (body.city_id !== undefined) patch.city_id = body.city_id || null
    if (body.starts_at !== undefined) patch.starts_at = body.starts_at || null
    if (body.ends_at !== undefined) patch.ends_at = body.ends_at || null
    if (body.external_url != null) {
      patch.external_url = body.external_url?.trim() || null
    }
    if (body.contact_email != null) {
      patch.contact_email = body.contact_email?.trim() || null
    }
    if (body.tags != null) patch.tags = parseGschTags(body.tags)
    if (body.is_published != null) patch.is_published = Boolean(body.is_published)

    if (Object.keys(patch).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data, error } = await supabase
      .from('gsch_events')
      .update(patch)
      .eq('id', id)
      .select(GSCH_EVENT_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'event_updated',
      entity_type: 'gsch_event',
      entity_id: id,
      metadata: patch,
    })

    if (patch.is_published === true && !existing.is_published) {
      await notifyGschOrgOwners(supabase, existing.organization_id, {
        type: 'gsch_event_published',
        title: 'Event published',
        message: `"${data.title}" is now published on Global Hub Events.`,
        data: { event_id: id },
        excludeUserId: user.id,
      })
    }

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update event', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const { deleteGschOrgEntity } = await import('@/lib/gsch/delete-entity')
    return deleteGschOrgEntity({
      supabase,
      userId: user.id,
      id,
      table: 'gsch_events',
      entityType: 'gsch_event',
      action: 'event_deleted',
      notFoundMessage: 'Event not found',
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to delete event', 500)
  }
}
