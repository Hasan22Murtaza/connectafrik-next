import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(_request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(_request)
    const supabase = createServiceClient()

    const { data: reels, error } = await supabase
      .from('reels')
      .select('likes_count, comments_count, shares_count, views_count, engagement_score')
      .eq('author_id', user.id)
      .eq('is_deleted', false)

    if (error) return errorResponse(error.message, 400)

    const rows = reels ?? []
    const total_reels = rows.length
    const total_views = rows.reduce((sum, r) => sum + (r.views_count ?? 0), 0)
    const total_likes = rows.reduce((sum, r) => sum + (r.likes_count ?? 0), 0)
    const total_comments = rows.reduce((sum, r) => sum + (r.comments_count ?? 0), 0)
    const total_shares = rows.reduce((sum, r) => sum + (r.shares_count ?? 0), 0)
    const avg_engagement =
      total_reels > 0 ? Number((rows.reduce((sum, r) => sum + Number(r.engagement_score ?? 0), 0) / total_reels).toFixed(2)) : 0

    return jsonResponse({
      data: {
        total_reels,
        total_views,
        total_likes,
        total_comments,
        total_shares,
        avg_engagement,
      },
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(err.message || 'Failed to fetch reel stats', 500)
  }
}

