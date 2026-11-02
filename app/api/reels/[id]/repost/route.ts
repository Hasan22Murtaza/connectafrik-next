import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient, getAccessTokenFromRequest } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reelId } = await params
    const { user } = await getAuthenticatedUser(request)
    const supabase = createServiceClient()

    const { data: reel, error: reelErr } = await supabase
      .from('reels')
      .select('id, author_id, is_deleted')
      .eq('id', reelId)
      .maybeSingle()

    if (reelErr || !reel || reel.is_deleted) {
      return errorResponse('Reel not found', 404)
    }

    const { data: existing } = await supabase
      .from('reel_reposts')
      .select('id')
      .eq('reel_id', reelId)
      .eq('user_id', user.id)
      .maybeSingle()

    let reposted: boolean
    if (existing) {
      const { error } = await supabase
        .from('reel_reposts')
        .delete()
        .eq('reel_id', reelId)
        .eq('user_id', user.id)
      if (error) return errorResponse(error.message, 400)
      reposted = false
    } else {
      const { error } = await supabase
        .from('reel_reposts')
        .insert({ reel_id: reelId, user_id: user.id })
      if (error) {
        if (error.code === '23505') {
          return jsonResponse({ data: { reposted: true } })
        }
        return errorResponse(error.message, 400)
      }
      reposted = true

      if (reel.author_id && reel.author_id !== user.id) {
        const { notifyIfAllowed, actorDisplayName } = await import('@/lib/notifications')
        const actorName = actorDisplayName(user)
        void notifyIfAllowed({
          recipientId: reel.author_id,
          actorId: user.id,
          type: 'reel_share',
          title: 'Reel Reposted',
          message: `${actorName} reposted your reel`,
          accessToken: getAccessTokenFromRequest(request),
          data: {
            action: 'repost',
            reel_id: reelId,
            actor_name: actorName,
            url: `/reels/${reelId}`,
          },
        })
      }
    }

    return jsonResponse({ data: { reposted } })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to toggle repost', 500)
  }
}
