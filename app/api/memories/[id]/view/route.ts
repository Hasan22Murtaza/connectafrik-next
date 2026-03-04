import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reelId } = await params
    const { user } = await getAuthenticatedUser(request)
    const supabase = createServiceClient()
    const body = await request.json().catch(() => ({}))
    const view_duration = body.view_duration ?? null
    const completion_rate = body.completion_rate ?? null

    const { error } = await supabase.from('reel_views').insert({
      reel_id: reelId,
      user_id: user.id,
      view_duration,
      completion_rate,
    })

    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(err.message || 'Failed to record view', 500)
  }
}
