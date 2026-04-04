import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { buildStoryApiRowFromDbRow } from '@/features/social/services/storyApiCodec'

const STORY_SELECT = `
  id, user_id, media_url, media_type, text_overlay, background_color,
  caption, music_url, music_title, music_artist, is_highlight,
  view_count, expires_at, created_at,
  profiles!stories_user_id_fkey ( full_name, avatar_url, username )
`

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data, error } = await supabase
      .from('stories')
      .select(STORY_SELECT)
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error.message, 400)

    const stories = (data || []).map((row) =>
      buildStoryApiRowFromDbRow({
        ...(row as Record<string, unknown>),
        has_viewed: true,
        is_viewed: true,
      })
    )

    return jsonResponse({ data: stories })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch stories', 500)
  }
}
