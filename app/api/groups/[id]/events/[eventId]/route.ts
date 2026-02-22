import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string; eventId: string }> }

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { eventId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { error } = await supabase
      .from('group_events')
      .delete()
      .eq('id', eventId)
      .eq('creator_id', user.id)

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to delete event', 500)
  }
}
