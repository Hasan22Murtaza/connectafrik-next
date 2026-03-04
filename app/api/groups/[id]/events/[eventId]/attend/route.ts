import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string; eventId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: existing } = await supabase
      .from('group_event_attendees')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle()

    const { data: eventRow } = await supabase
      .from('group_events')
      .select('attendee_count')
      .eq('id', eventId)
      .single()

    const currentCount = eventRow?.attendee_count ?? 0

    if (existing) {
      const { error } = await supabase
        .from('group_event_attendees')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', user.id)

      if (error) return errorResponse(error.message, 400)

      await supabase
        .from('group_events')
        .update({ attendee_count: Math.max(0, currentCount - 1) })
        .eq('id', eventId)

      return jsonResponse({ attending: false, attendee_count: Math.max(0, currentCount - 1) })
    }

    const { error } = await supabase
      .from('group_event_attendees')
      .insert({ event_id: eventId, user_id: user.id })

    if (error) return errorResponse(error.message, 400)

    await supabase
      .from('group_events')
      .update({ attendee_count: currentCount + 1 })
      .eq('id', eventId)

    return jsonResponse({ attending: true, attendee_count: currentCount + 1 })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to toggle attendance', 500)
  }
}
