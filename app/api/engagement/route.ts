import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json()

    const events = body.events as any[] | undefined
    const singleEvent = !events ? body : null

    const rows = (events || [singleEvent]).filter(Boolean).map((e: any) => ({
      user_id: user.id,
      post_id: e.post_id,
      event_type: e.event_type,
      content_type: e.content_type ?? 'post',
      dwell_ms: e.dwell_ms ?? null,
      percent_viewed: e.percent_viewed ?? null,
    }))

    if (rows.length === 0) {
      return errorResponse('No events provided', 400)
    }

    const { error } = await serviceClient.from('user_events').insert(rows)

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({ success: true, count: rows.length })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
