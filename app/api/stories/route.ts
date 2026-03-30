import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const STORY_SELECT = `
  id, user_id, media_url, media_type, text_overlay, background_color,
  caption, music_url, music_title, music_artist, is_highlight,
  view_count, expires_at, created_at,
  profiles!stories_user_id_fkey ( full_name, avatar_url, username )
`

const parseTextOverlay = (overlay: unknown) => {
  if (!overlay) return null
  try {
    return typeof overlay === 'string' ? JSON.parse(overlay) : overlay
  } catch {
    return null
  }
}

const parseGradientColors = (
  gradient: string | null | undefined
): { start: string; end: string } | null => {
  if (!gradient || typeof gradient !== 'string') return null
  const trimmed = gradient.trim()
  if (!trimmed) return null

  const parts = trimmed.split(',').map(part => part.trim()).filter(Boolean)
  if (parts.length >= 2 && parts[0].startsWith('#') && parts[1].startsWith('#')) {
    return { start: parts[0], end: parts[1] }
  }
  return null
}

const toStoryResponse = (story: any) => {
  const profileData = story?.profiles
  const textOverlay = parseTextOverlay(story?.text_overlay) as { gradient?: string } | null
  const backgroundGradient =
    typeof story?.background_gradient === 'string' && story.background_gradient.trim()
      ? story.background_gradient
      : (typeof textOverlay?.gradient === 'string' ? textOverlay.gradient : null)

  return {
    id: story.id || story.story_id,
    user_id: story.user_id,
    user_name: profileData?.full_name || story.user_name || story.full_name || story.username || 'Unknown',
    user_avatar: profileData?.avatar_url || story.user_avatar || story.profile_picture_url || '',
    username: profileData?.username || story.username || '',
    profile_picture_url: profileData?.avatar_url || story.profile_picture_url || story.user_avatar || '',
    media_url: story.media_url,
    media_type: story.media_type,
    text_overlay: story.text_overlay,
    background_color: story.background_color || '#2563eb',
    background_gradient: backgroundGradient,
    caption: story.caption,
    music_url: story.music_url,
    music_title: story.music_title || null,
    music_artist: story.music_artist || null,
    is_highlight: Boolean(story.is_highlight),
    view_count: story.view_count || 0,
    expires_at: story.expires_at,
    created_at: story.created_at,
    has_viewed: Boolean(story.has_viewed ?? story.is_viewed ?? false),
    reaction_count: story.reaction_count || 0,
    reply_count: story.reply_count || 0,
    user_reaction: story.user_reaction || null,
  }
}

const groupStoriesByUser = (stories: any[]) => {
  const grouped = new Map<string, any>()

  stories.forEach((story) => {
    if (!story?.id || !story?.user_id) return

    if (!grouped.has(story.user_id)) {
      grouped.set(story.user_id, {
        user_id: story.user_id,
        username: story.username || '',
        user_name: story.user_name || 'Unknown',
        user_avatar: story.user_avatar || '',
        profile_picture_url: story.profile_picture_url || story.user_avatar || '',
        has_unviewed: false,
        stories: [],
      })
    }

    const bucket = grouped.get(story.user_id)
    bucket.stories.push(story)
    if (!story.has_viewed) bucket.has_unviewed = true
  })

  const groups = Array.from(grouped.values())
  groups.forEach((group) => {
    group.stories.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    group.latest_story_at = group.stories[0]?.created_at || null
  })

  groups.sort((a, b) => new Date(b.latest_story_at || 0).getTime() - new Date(a.latest_story_at || 0).getTime())
  return groups
}

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('userId')
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '5', 10) || 5, 1), 50)
    const from = page * limit
    const to = from + limit

    if (targetUserId) {
      const { data, error } = await supabase
        .from('stories')
        .select(STORY_SELECT)
        .eq('user_id', targetUserId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .range(from, to - 1)

      if (error) return errorResponse(error.message, 400)

      const stories = (data || []).map(toStoryResponse)
      return jsonResponse({
        data: stories,
        page,
        pageSize: limit,
        hasMore: stories.length === limit,
      })
    }

    const { data, error } = await supabase.rpc('get_story_recommendations', {
      user_id_param: user.id,
    })

    if (error) return errorResponse(error.message, 400)

    const stories = (data || []).map(toStoryResponse)
    const groupedStories = groupStoriesByUser(stories)
    const paged = groupedStories.slice(from, to)
    return jsonResponse({
      data: paged,
      page,
      pageSize: limit,
      hasMore: groupedStories.length > to,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch stories', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const {
      media_url,
      media_type,
      caption,
      music_url,
      music_title,
      music_artist,
      text_overlay,
      text,
      text_color,
      background_color,
      background_gradient,
      is_highlight,
    } = body

    const sanitizedMediaUrl = typeof media_url === 'string' && media_url.trim() ? media_url.trim() : null
    const sanitizedText = typeof text === 'string' ? text.trim() : ''
    const sanitizedTextColor = typeof text_color === 'string' && text_color.trim() ? text_color : '#FFFFFF'
    const sanitizedBackgroundGradient =
      typeof background_gradient === 'string' && background_gradient.trim()
        ? background_gradient.trim()
        : null

    const isGradientMediaUrl = typeof sanitizedMediaUrl === 'string' && sanitizedMediaUrl.startsWith('gradient:')
    const isTextStory = Boolean(sanitizedText) || Boolean(sanitizedBackgroundGradient) || isGradientMediaUrl
    const normalizedMediaType =
      media_type === 'image' || media_type === 'video'
        ? media_type
        : (isTextStory ? 'image' : null)

    if (!isTextStory && !sanitizedMediaUrl) {
      return errorResponse('media_url is required', 400)
    }
    if (!normalizedMediaType) {
      return errorResponse('media_type is required', 400)
    }

    const sanitizedBackgroundColor =
      typeof background_color === 'string' && background_color.trim()
        ? background_color
        : (isTextStory ? '#2563eb' : '#000000')
    const gradientFromMediaUrl = isGradientMediaUrl
      ? sanitizedMediaUrl.replace(/^gradient:/, '').trim()
      : null
    const normalizedGradient =
      sanitizedBackgroundGradient || gradientFromMediaUrl || `${sanitizedBackgroundColor},#1d4ed8`
    const parsedGradient = parseGradientColors(normalizedGradient)

    if (isTextStory && !sanitizedText) {
      return errorResponse('text is required for text stories', 400)
    }

    const normalizedTextOverlay = isTextStory
      ? JSON.stringify({
          text: sanitizedText,
          color: sanitizedTextColor,
          fontSize: 24,
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          backgroundColor: 'transparent',
          align: 'center',
          isBold: false,
          gradient: parsedGradient
            ? `${parsedGradient.start},${parsedGradient.end}`
            : normalizedGradient,
          x: 50,
          y: 50,
        })
      : (text_overlay || null)

    const { data, error } = await supabase
      .from('stories')
      .insert({
        user_id: user.id,
        media_url: isTextStory ? null : sanitizedMediaUrl,
        media_type: normalizedMediaType,
        caption: isTextStory ? sanitizedText : (caption || null),
        music_url: isTextStory ? null : (music_url || null),
        music_title: isTextStory ? null : (music_title || null),
        music_artist: isTextStory ? null : (music_artist || null),
        text_overlay: normalizedTextOverlay,
        background_color: sanitizedBackgroundColor,
        is_highlight: is_highlight || false,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select(STORY_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    const story = toStoryResponse(data as any)

    return jsonResponse({ data: story }, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to create story', 500)
  }
}
