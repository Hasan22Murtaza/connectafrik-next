import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: storyId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    // Try the RPC first
    const { error: rpcError } = await supabase.rpc('record_story_view', {
      story_id_param: storyId,
      viewer_id_param: user.id,
    })

    if (rpcError) {
      // Fallback to direct upsert
      const { error } = await supabase
        .from('story_views')
        .upsert(
          { story_id: storyId, viewer_id: user.id, viewed_at: new Date().toISOString() },
          { onConflict: 'story_id,viewer_id', ignoreDuplicates: true }
        )

      if (error && !error.message.includes('duplicate')) {
        return errorResponse(error.message, 400)
      }
    }

    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to record view', 500)
  }
}
