import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const TOP_REEL_SELECT = `
  id, title, thumbnail_url, video_url, duration, category,
  likes_count, comments_count, shares_count, views_count, saves_count,
  engagement_score, created_at, is_public
`

/** GET /api/reels/analytics — aggregate performance + top reels for the viewer */
export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const supabase = createServiceClient()

    const { data: reels, error } = await supabase
      .from('reels')
      .select(TOP_REEL_SELECT)
      .eq('author_id', user.id)
      .eq('is_deleted', false)
      .order('engagement_score', { ascending: false })

    if (error) return errorResponse(error.message, 400)

    const rows = reels ?? []
    const total_reels = rows.length
    const total_views = rows.reduce((sum, r) => sum + (r.views_count ?? 0), 0)
    const total_likes = rows.reduce((sum, r) => sum + (r.likes_count ?? 0), 0)
    const total_comments = rows.reduce((sum, r) => sum + (r.comments_count ?? 0), 0)
    const total_shares = rows.reduce((sum, r) => sum + (r.shares_count ?? 0), 0)
    const total_saves = rows.reduce((sum, r) => sum + (r.saves_count ?? 0), 0)
    const avg_engagement =
      total_reels > 0
        ? Number(
            (
              rows.reduce((sum, r) => sum + Number(r.engagement_score ?? 0), 0) / total_reels
            ).toFixed(2)
          )
        : 0

    const engagement_actions = total_likes + total_comments + total_shares + total_saves
    const engagement_rate =
      total_views > 0 ? Number(((engagement_actions / total_views) * 100).toFixed(1)) : 0

    const top_reels = [...rows]
      .sort((a, b) => {
        const viewDiff = (b.views_count ?? 0) - (a.views_count ?? 0)
        if (viewDiff !== 0) return viewDiff
        return Number(b.engagement_score ?? 0) - Number(a.engagement_score ?? 0)
      })
      .slice(0, 8)

    const by_category: Record<string, number> = {}
    for (const r of rows) {
      const key = (r.category || 'other').toLowerCase()
      by_category[key] = (by_category[key] ?? 0) + 1
    }

    return jsonResponse({
      data: {
        total_reels,
        total_views,
        total_likes,
        total_comments,
        total_shares,
        total_saves,
        avg_engagement,
        engagement_rate,
        engagement_mix: {
          likes: total_likes,
          comments: total_comments,
          shares: total_shares,
          saves: total_saves,
        },
        by_category,
        top_reels,
      },
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to fetch reel analytics', 500)
  }
}
