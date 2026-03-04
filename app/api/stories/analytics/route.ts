import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: stories, error } = await supabase
      .from('stories')
      .select(`
        id, user_id, media_url, media_type, text_overlay, background_color,
        caption, music_url, music_title, music_artist, is_highlight,
        view_count, expires_at, created_at,
        story_views (id),
        story_reactions (id),
        story_replies (id)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error.message, 400)

    const items = stories || []
    const totalStories = items.length
    const totalViews = items.reduce((sum: number, s: any) => sum + (s.view_count || s.story_views?.length || 0), 0)
    const totalReactions = items.reduce((sum: number, s: any) => sum + (s.story_reactions?.length || 0), 0)
    const totalReplies = items.reduce((sum: number, s: any) => sum + (s.story_replies?.length || 0), 0)
    const averageViews = totalStories > 0 ? totalViews / totalStories : 0

    const topStories = items
      .map((s: any) => ({ ...s, computed_view_count: s.view_count || s.story_views?.length || 0 }))
      .sort((a: any, b: any) => b.computed_view_count - a.computed_view_count)
      .slice(0, 5)
      .map((s: any) => ({
        id: s.id,
        user_id: s.user_id,
        media_url: s.media_url,
        media_type: s.media_type,
        text_overlay: s.text_overlay,
        background_color: s.background_color,
        caption: s.caption,
        view_count: s.computed_view_count,
        expires_at: s.expires_at,
        created_at: s.created_at,
      }))

    return jsonResponse({
      data: { totalStories, totalViews, totalReactions, totalReplies, averageViews, topStories },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch analytics', 500)
  }
}
