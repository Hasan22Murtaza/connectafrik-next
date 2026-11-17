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

    const { data: reel } = await supabase
      .from('reels')
      .select('id, is_deleted, is_public, author_id')
      .eq('id', reelId)
      .maybeSingle()

    if (!reel || reel.is_deleted) return errorResponse('Reel not found', 404)
    if (!reel.is_public && reel.author_id !== user.id) {
      return errorResponse('Reel not found', 404)
    }

    const { data: existing } = await supabase
      .from('reel_views')
      .select('id')
      .eq('reel_id', reelId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      // Update watch metrics without inflating views_count (trigger is INSERT-only).
      if (view_duration != null || completion_rate != null) {
        await supabase
          .from('reel_views')
          .update({
            ...(view_duration != null ? { view_duration } : {}),
            ...(completion_rate != null ? { completion_rate } : {}),
          })
          .eq('id', existing.id)
      }
      return jsonResponse({ success: true, recorded: false })
    }

    const { error } = await supabase.from('reel_views').insert({
      reel_id: reelId,
      user_id: user.id,
      view_duration,
      completion_rate,
    })

    if (error) {
      // Race: unique index may reject a duplicate insert.
      if (error.code === '23505') {
        return jsonResponse({ success: true, recorded: false })
      }
      return errorResponse(error.message, 400)
    }
    return jsonResponse({ success: true, recorded: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(err.message || 'Failed to record view', 500)
  }
}
