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
      .from('reel_likes')
      .select('id')
      .eq('reel_id', reelId)
      .eq('user_id', user.id)
      .maybeSingle()

    let liked: boolean
    if (existing) {
      const { error } = await supabase.from('reel_likes').delete().eq('reel_id', reelId).eq('user_id', user.id)
      if (error) return errorResponse(error.message, 400)
      liked = false
    } else {
      const { error } = await supabase.from('reel_likes').insert({ reel_id: reelId, user_id: user.id })
      if (error) return errorResponse(error.message, 400)
      liked = true
    }

    return jsonResponse({ data: { liked } })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(err.message || 'Failed to toggle like', 500)
  }
}
