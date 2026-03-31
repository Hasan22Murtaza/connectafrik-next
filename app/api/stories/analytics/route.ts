import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const normalizeGradientValue = (value: string | null | undefined): string | null => {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.startsWith('gradient:') ? trimmed.replace(/^gradient:/, '').trim() : trimmed
}

const parseTextOverlay = (overlay: unknown) => {
  if (!overlay) return null
  try {
    return typeof overlay === 'string' ? JSON.parse(overlay) : overlay
  } catch {
    return null
  }
}

const parseGradientColors = (value: string | null | undefined): string[] | null => {
  const normalized = normalizeGradientValue(value)
  if (!normalized) return null
  const parts = normalized.split(',').map(part => part.trim()).filter(Boolean)
  if (parts.length < 2) return null
  return [parts[0], parts[1]]
}

const compactObject = <T extends Record<string, any>>(obj: T) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== null && value !== undefined && value !== '')
  )
}

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
      .map((s: any) => {
        const textOverlay = parseTextOverlay(s.text_overlay) as { gradient?: string } | null
        const rawGradient =
          (typeof s?.background_gradient === 'string' && s.background_gradient.trim()
            ? s.background_gradient
            : null) ||
          (typeof s?.media_url === 'string' && s.media_url.startsWith('gradient:')
            ? s.media_url
            : null) ||
          (typeof textOverlay?.gradient === 'string' ? textOverlay.gradient : null)
        const backgroundGradient = normalizeGradientValue(rawGradient)
        const backgroundGradientColors = parseGradientColors(backgroundGradient)
        const isTextStory =
          s?.media_type === 'text' ||
          Boolean(textOverlay) ||
          Boolean(backgroundGradient) ||
          (typeof s?.media_url === 'string' && s.media_url.startsWith('gradient:')) ||
          !s?.media_url

        return compactObject({
          id: s.id,
          user_id: s.user_id,
          media_url: s.media_url,
          media_type: isTextStory ? 'text' : s.media_type,
          text_overlay: s.text_overlay,
          background_color: s.background_color,
          background_gradient: backgroundGradient,
          background_gradient_colors: backgroundGradientColors,
          caption: s.caption,
          view_count: s.computed_view_count,
          expires_at: s.expires_at,
          created_at: s.created_at,
        })
      })

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
