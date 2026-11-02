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

    const { data: existing } = await supabase
      .from('reel_saves')
      .select('id')
      .eq('reel_id', reelId)
      .eq('user_id', user.id)
      .maybeSingle()

    let saved: boolean
    if (existing) {
      const { error } = await supabase.from('reel_saves').delete().eq('reel_id', reelId).eq('user_id', user.id)
      if (error) return errorResponse(error.message, 400)
      saved = false
    } else {
      const { error } = await supabase.from('reel_saves').insert({ reel_id: reelId, user_id: user.id })
      if (error) return errorResponse(error.message, 400)
      saved = true
    }

    return jsonResponse({ data: { saved } })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(err.message || 'Failed to toggle save', 500)
  }
}
