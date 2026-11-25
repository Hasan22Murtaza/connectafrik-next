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

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)

    const q = searchParams.get('q')?.trim() || ''
    const eventType = searchParams.get('event_type')?.trim() || ''
    const country = searchParams.get('country')?.trim() || ''
    const continent = searchParams.get('continent')?.trim() || ''
    const mine = searchParams.get('mine') === '1'
    const upcoming = searchParams.get('upcoming') === '1'
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1),
      50
    )
    const from = page * limit
    const to = from + limit - 1

    let query = supabase
      .from('gsch_events')
      .select(GSCH_EVENT_SELECT)
      .order(upcoming ? 'starts_at' : 'created_at', {
        ascending: upcoming,
        nullsFirst: false,
      })
      .range(from, to)

    if (mine) {
      const { data: memberships } = await supabase
        .from('gsch_memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
      const orgIds = (memberships || []).map((m) => m.organization_id)
      if (orgIds.length === 0) {
        return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
      }
      query = query.in('organization_id', orgIds)
    } else {
      query = query.eq('is_published', true)
    }

    if (upcoming) {
      query = query.gte('starts_at', new Date().toISOString())
    }
    if (eventType) query = query.eq('event_type', eventType)
    if (country) query = query.ilike('country', `%${country}%`)
    if (continent) query = query.ilike('continent', `%${continent}%`)
    if (q) {
      query = query.or(
        `title.ilike.%${q}%,summary.ilike.%${q}%,description.ilike.%${q}%,location_label.ilike.%${q}%`
      )
    }

    const { data, error } = await query
    if (error) return errorResponse(error.message, 400)

    const eventIds = (data || []).map((e) => e.id)
    let registeredIds = new Set<string>()
    if (eventIds.length > 0) {
      const { data: regs } = await supabase
        .from('gsch_event_registrations')
        .select('event_id')
        .eq('user_id', user.id)
        .eq('status', 'registered')
        .in('event_id', eventIds)
      registeredIds = new Set((regs || []).map((r) => r.event_id))
    }

    return jsonResponse({
      data: (data || []).map((e) => ({
        ...e,
        is_registered: registeredIds.has(e.id),
      })),
      page,
      pageSize: limit,
      hasMore: (data || []).length === limit,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load events', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    if (!body.organization_id) return errorResponse('organization_id is required', 400)
    if (!body.title?.trim()) return errorResponse('title is required', 400)
    if (!EVENT_TYPES.includes(body.event_type)) {
      return errorResponse('Invalid event_type', 400)
    }

    const authz = await requireOrgRole(
      supabase,
      body.organization_id,
      user.id,
      'representative'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const { data, error } = await supabase
      .from('gsch_events')
      .insert({
        organization_id: body.organization_id,
        city_id: body.city_id || null,
        title: String(body.title).trim(),
        summary: body.summary?.trim() || null,
        description: body.description?.trim() || null,
        event_type: body.event_type,
        country: body.country?.trim() || null,
        continent: body.continent?.trim() || null,
        location_label: body.location_label?.trim() || null,
        starts_at: body.starts_at || null,
        ends_at: body.ends_at || null,
        external_url: body.external_url?.trim() || null,
        contact_email: body.contact_email?.trim() || null,
        tags: parseGschTags(body.tags),
        is_published: Boolean(body.is_published),
        created_by: user.id,
      })
      .select(GSCH_EVENT_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'event_created',
      entity_type: 'gsch_event',
      entity_id: data.id,
      metadata: {
        title: data.title,
        is_published: data.is_published,
        event_type: data.event_type,
      },
    })

    if (data.is_published) {
      await notifyGschOrgOwners(supabase, body.organization_id, {
        type: 'gsch_event_published',
        title: 'Event published',
        message: `"${data.title}" is now published on Global Hub Events.`,
        data: { event_id: data.id },
        excludeUserId: user.id,
      })
    }

    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create event', 500)
  }
}
