import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10) || 10, 1), 50)
    const from = page * limit
    const to = from + limit - 1

    const { data: eventsData, error: eventsError } = await supabase
      .from('group_events')
      .select('*')
      .eq('group_id', groupId)
      .order('start_time', { ascending: true })
      .range(from, to)

    if (eventsError) {
      return errorResponse(eventsError.message, 400)
    }

    const events = eventsData || []
    if (events.length === 0) {
      return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
    }

    const creatorIds = [...new Set(events.map((e: { creator_id: string }) => e.creator_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', creatorIds)

    const profileMap = new Map((profiles || []).map((p: { id: string }) => [p.id, p]))

    const { data: attendeesData } = await supabase
      .from('group_event_attendees')
      .select('event_id')
      .eq('user_id', user.id)
      .in('event_id', events.map((e: { id: string }) => e.id))

    const attendingEventIds = new Set(
      (attendeesData || []).map((a: { event_id: string }) => a.event_id)
    )

    const result = events.map((e: { id: string; creator_id: string }) => ({
      ...e,
      creator: profileMap.get(e.creator_id) ?? null,
      isAttending: attendingEventIds.has(e.id),
    }))

    return jsonResponse({
      data: result,
      page,
      pageSize: limit,
      hasMore: events.length === limit,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to fetch events', 500)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const {
      title,
      description,
      event_type,
      start_time,
      end_time,
      location,
      is_virtual,
      max_attendees,
      is_public,
    } = body

    if (!title || !event_type || !start_time) {
      return errorResponse('title, event_type, and start_time are required', 400)
    }

    const { data: event, error: insertError } = await supabase
      .from('group_events')
      .insert({
        group_id: groupId,
        creator_id: user.id,
        title,
        description: description ?? null,
        event_type,
        start_time,
        end_time: end_time ?? null,
        location: location ?? null,
        is_virtual: is_virtual ?? false,
        max_attendees: max_attendees ?? null,
        is_public: is_public ?? true,
        attendee_count: 0,
        status: 'scheduled',
      })
      .select()
      .single()

    if (insertError) {
      return errorResponse(insertError.message, 400)
    }

    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .eq('id', user.id)
      .single()

    return jsonResponse(
      { data: { ...event, creator: creatorProfile ?? null } },
      201
    )
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to create event', 500)
  }
}
