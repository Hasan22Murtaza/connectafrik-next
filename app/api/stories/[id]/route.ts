import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: storyId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { error } = await supabase
      .from('stories')
      .delete()
      .eq('id', storyId)
      .eq('user_id', user.id)

    if (error) return errorResponse(error.message, 400)

    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to delete story', 500)
  }
}
