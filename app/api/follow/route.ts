import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { notificationService } from '@/shared/services/notificationService'

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()
    const following_id = body?.following_id as string | undefined

    if (!following_id) {
      return errorResponse('following_id is required', 400)
    }

    if (following_id === user.id) {
      return errorResponse('Cannot follow yourself', 400)
    }

    const { data: existing } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', following_id)
      .maybeSingle()

    if (existing) {
      return jsonResponse({ success: true, followed: true })
    }

    const { error: insertError } = await supabase
      .from('follows')
      .insert({ follower_id: user.id, following_id })

    if (insertError) {
      return errorResponse(insertError.message, 400)
    }

    await supabase.rpc('increment_following_count', { user_id: user.id })
    await supabase.rpc('increment_follower_count', { user_id: following_id })

    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('follow_notifications')
      .eq('id', following_id)
      .single()

    if (targetProfile?.follow_notifications) {
      const { data: followerProfile } = await supabase
        .from('profiles')
        .select('username, full_name')
        .eq('id', user.id)
        .single()
      const follower_name = followerProfile?.full_name || followerProfile?.username || 'Someone'
      await notificationService.sendNotification({
        user_id: following_id,
        title: 'New Tap In!',
        body: `${follower_name} tapped in to follow you`,
        notification_type: 'follow',
        data: {
          type: 'follow',
          follower_id: user.id,
          follower_name,
          url: `/user/${followerProfile?.username || user.id}`,
        },
      })
    }

    return jsonResponse({ success: true, followed: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()
    const following_id = body?.following_id as string | undefined

    if (!following_id) {
      return errorResponse('following_id is required', 400)
    }

    const { error: deleteError } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', following_id)

    if (deleteError) {
      return errorResponse(deleteError.message, 400)
    }

    await supabase.rpc('decrement_following_count', { user_id: user.id })
    await supabase.rpc('decrement_follower_count', { user_id: following_id })

    return jsonResponse({ success: true, unfollowed: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}
