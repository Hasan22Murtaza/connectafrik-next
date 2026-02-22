import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const STORY_SELECT = `
  id, user_id, media_url, media_type, text_overlay, background_color,
  caption, music_url, music_title, music_artist, is_highlight,
  view_count, expires_at, created_at,
  profiles!stories_user_id_fkey ( full_name, avatar_url )
`

type RouteContext = { params: Promise<{ userId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params
    const { supabase } = await getAuthenticatedUser(request)

    const { data, error } = await supabase
      .from('stories')
      .select(STORY_SELECT)
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error.message, 400)

    const stories = (data || []).map((story: any) => ({
      id: story.id,
      user_id: story.user_id,
      user_name: story.profiles?.full_name || 'Unknown',
      user_avatar: story.profiles?.avatar_url || '',
      media_url: story.media_url,
      media_type: story.media_type,
      text_overlay: story.text_overlay,
      background_color: story.background_color,
      caption: story.caption,
      music_url: story.music_url,
      music_title: story.music_title,
      music_artist: story.music_artist,
      is_highlight: story.is_highlight,
      view_count: story.view_count || 0,
      expires_at: story.expires_at,
      created_at: story.created_at,
      has_viewed: false,
    }))

    return jsonResponse({ data: stories })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch user stories', 500)
  }
}
