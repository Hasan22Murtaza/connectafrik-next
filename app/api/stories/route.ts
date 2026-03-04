import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const STORY_SELECT = `
  id, user_id, media_url, media_type, text_overlay, background_color,
  caption, music_url, music_title, music_artist, is_highlight,
  view_count, expires_at, created_at,
  profiles!stories_user_id_fkey ( full_name, avatar_url, username )
`

const toStoryResponse = (story: any) => {
  const profileData = story?.profiles
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

    const { media_url, media_type, caption, music_url, music_title, music_artist, text_overlay, background_color, is_highlight } = body

    if (!media_url || !media_type) {
      return errorResponse('media_url and media_type are required', 400)
    }

    const { data, error } = await supabase
      .from('stories')
      .insert({
        user_id: user.id,
        media_url,
        media_type,
        caption: caption || null,
        music_url: music_url || null,
        music_title: music_title || null,
        music_artist: music_artist || null,
        text_overlay: text_overlay || null,
        background_color: background_color || '#000000',
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
