import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: storyId } = await context.params
    const { supabase } = await getAuthenticatedUser(request)

    const { data: views, error } = await supabase
      .from('story_views')
      .select('id, story_id, viewer_id, viewed_at')
      .eq('story_id', storyId)
      .order('viewed_at', { ascending: false })

    if (error) return errorResponse(error.message, 400)
    if (!views || views.length === 0) return jsonResponse({ data: [] })

    const viewerIds = [...new Set(views.map((v: any) => v.viewer_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', viewerIds)

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

    const result = views.map((view: any) => {
      const profile = profileMap.get(view.viewer_id) as any
      return {
        id: view.id,
        story_id: view.story_id,
        viewer_id: view.viewer_id,
        viewed_at: view.viewed_at,
        viewer_name: profile?.full_name || 'Unknown',
        viewer_avatar: profile?.avatar_url || '',
      }
    })

    return jsonResponse({ data: result })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch viewers', 500)
  }
}
