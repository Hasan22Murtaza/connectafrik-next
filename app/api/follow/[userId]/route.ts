import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ userId: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { userId } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: follow } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', userId)
      .maybeSingle()

    return jsonResponse({ is_following: !!follow })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { userId } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { error: deleteError } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', userId)

    if (deleteError) {
      return errorResponse(deleteError.message, 400)
    }

    await supabase.rpc('decrement_following_count', { user_id: user.id })
    await supabase.rpc('decrement_follower_count', { user_id: userId })

    return jsonResponse({ success: true, unfollowed: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}
