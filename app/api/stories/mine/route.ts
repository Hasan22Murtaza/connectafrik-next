import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const STORY_SELECT = `
  id, user_id, media_url, media_type, text_overlay, background_color,
  caption, music_url, music_title, music_artist, is_highlight,
  view_count, expires_at, created_at,
  profiles!stories_user_id_fkey ( full_name, avatar_url )
`

const parseTextOverlay = (overlay: unknown) => {
  if (!overlay) return null
  try {
    return typeof overlay === 'string' ? JSON.parse(overlay) : overlay
  } catch {
    return null
  }
}

const normalizeGradientValue = (value: string | null | undefined): string | null => {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.startsWith('gradient:') ? trimmed.replace(/^gradient:/, '').trim() : trimmed
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
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '5', 10) || 5, 1), 50)
    const from = page * limit
    const to = from + limit - 1

    const { data, error } = await supabase
      .from('stories')
      .select(STORY_SELECT)
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return errorResponse(error.message, 400)

    const stories = (data || []).map((story: any) => {
      const textOverlay = parseTextOverlay(story.text_overlay) as { gradient?: string } | null
      const rawGradient =
        (typeof story?.background_gradient === 'string' && story.background_gradient.trim()
          ? story.background_gradient
          : null) ||
        (typeof story?.media_url === 'string' && story.media_url.startsWith('gradient:')
          ? story.media_url
          : null) ||
        (typeof textOverlay?.gradient === 'string' ? textOverlay.gradient : null)
      const backgroundGradient = normalizeGradientValue(rawGradient)
      const backgroundGradientColors = parseGradientColors(backgroundGradient)
      const isTextStory =
        story?.media_type === 'text' ||
        Boolean(textOverlay) ||
        Boolean(backgroundGradient) ||
        (typeof story?.media_url === 'string' && story.media_url.startsWith('gradient:')) ||
        !story?.media_url

      return compactObject({
        id: story.id,
        user_id: story.user_id,
        user_name: story.profiles?.full_name || 'Unknown',
        user_avatar: story.profiles?.avatar_url || '',
        media_url: story.media_url,
        media_type: isTextStory ? 'text' : story.media_type,
        text_overlay: story.text_overlay,
        background_color: story.background_color,
        background_gradient: backgroundGradient,
        background_gradient_colors: backgroundGradientColors,
        caption: story.caption,
        music_url: story.music_url,
        music_title: story.music_title || undefined,
        music_artist: story.music_artist || undefined,
        is_highlight: story.is_highlight,
        view_count: story.view_count || 0,
        expires_at: story.expires_at,
        created_at: story.created_at,
        has_viewed: true,
      })
    })

    return jsonResponse({
      data: stories,
      page,
      pageSize: limit,
      hasMore: stories.length === limit,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch stories', 500)
  }
}
