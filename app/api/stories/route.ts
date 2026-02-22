import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const STORY_SELECT = `
  id, user_id, media_url, media_type, text_overlay, background_color,
  caption, music_url, music_title, music_artist, is_highlight,
  view_count, expires_at, created_at,
  profiles!stories_user_id_fkey ( full_name, avatar_url, username )
`

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data, error } = await supabase.rpc('get_story_recommendations', {
      user_id_param: user.id,
    })

    if (error) return errorResponse(error.message, 400)

    return jsonResponse({ data: data || [] })
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

    const profileData = (data as any).profiles
    const story = {
      id: data.id,
      user_id: data.user_id,
      user_name: profileData?.full_name || 'Unknown',
      user_avatar: profileData?.avatar_url || '',
      username: profileData?.username || '',
      media_url: data.media_url,
      media_type: data.media_type,
      text_overlay: data.text_overlay,
      background_color: data.background_color,
      caption: data.caption,
      music_url: data.music_url,
      music_title: data.music_title,
      music_artist: data.music_artist,
      is_highlight: data.is_highlight,
      view_count: data.view_count || 0,
      expires_at: data.expires_at,
      created_at: data.created_at,
      has_viewed: false,
    }

    return jsonResponse({ data: story }, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to create story', 500)
  }
}
