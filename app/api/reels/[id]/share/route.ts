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
    const body = await request.json()
    const { share_type, platform } = body

    if (!share_type) return errorResponse('share_type is required', 400)

    const { error } = await supabase.from('reel_shares').insert({
      reel_id: reelId,
      user_id: user.id,
      share_type,
      platform: platform ?? null,
    })

    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(err.message || 'Failed to record share', 500)
  }
}
