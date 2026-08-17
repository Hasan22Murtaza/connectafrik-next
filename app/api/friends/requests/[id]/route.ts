import { NextRequest } from 'next/server'
import { getAuthenticatedUser, getAccessTokenFromRequest, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { createNotification } from '@/lib/notifications/createNotification'
import { notificationService } from '@/shared/services/notificationService'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase } = await getAuthenticatedUser(request)

    const { data: row, error } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status, created_at, updated_at')
      .eq('id', id)
      .single()

    if (error || !row) {
      return errorResponse('Friend request not found', 404)
    }

    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .eq('id', row.sender_id)
      .single()

    return jsonResponse({
      ...row,
      sender: senderProfile || null,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch friend request', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const accessToken = getAccessTokenFromRequest(request)

    const body = await request.json().catch(() => ({}))
    const status = body?.status

    if (!status || !['accepted', 'declined', 'blocked'].includes(status)) {
      return errorResponse('status must be one of: accepted, declined, blocked', 400)
    }

    const { data: row, error: fetchError } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status')
      .eq('id', id)
      .single()

    if (fetchError || !row) {
      return errorResponse('Friend request not found', 404)
    }

    if (row.receiver_id !== user.id) {
      return errorResponse('Forbidden', 403)
    }

    if (row.status !== 'pending') {
      return errorResponse('Request already responded to', 400)
    }

    const { data: updated, error: updateError } = await supabase
      .from('friend_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return errorResponse(updateError.message, 400)
    }

    // Notify the original sender — same notifications.insert shape as post_create
    if (row.sender_id && row.sender_id !== user.id && (status === 'accepted' || status === 'declined')) {
      const { data: receiverProfile } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', user.id)
        .single()

      const receiverName = receiverProfile?.full_name || receiverProfile?.username || 'Someone'
      const isAccepted = status === 'accepted'
      const notificationType = isAccepted ? 'friend_request_accepted' : 'friend_request_declined'
      const title = isAccepted ? 'Friend request accepted' : 'Friend request declined'
      const message = isAccepted
        ? `${receiverName} accepted your friend request.`
        : `${receiverName} declined your friend request.`
      const notificationRow = {
        user_id: row.sender_id,
        type: notificationType,
        title,
        message,
        data: {
          type: notificationType,
          sender_id: user.id,
          receiver_id: user.id,
          friend_request_id: row.id,
          receiver_name: receiverName,
          actor_id: user.id,
          actor_name: receiverName,
          actor_avatar: receiverProfile?.avatar_url || '',
          url: isAccepted ? `/user/${user.id}` : '/friends',
        },
        is_read: false,
      }

      try {
        const serviceSupabase = createServiceClient()
        const { error: insertError } = await serviceSupabase.from('notifications').insert(notificationRow)
        if (insertError) {
          console.error('Friend request response notification insert failed:', insertError)
          await createNotification({
            user_id: notificationRow.user_id,
            type: notificationType,
            title,
            message,
            data: notificationRow.data,
          })
        }
      } catch (error) {
        console.error('Failed to save friend request response notification:', error)
      }

      try {
        await notificationService.sendNotification(
          {
            user_id: row.sender_id,
            title,
            body: message,
            notification_type: notificationType,
            skip_db: true,
            data: notificationRow.data,
          },
          { accessToken },
        )
      } catch (error) {
        console.error('Failed to send friend request response push:', error)
      }
    }

    return jsonResponse(updated)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to update friend request', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: row, error: fetchError } = await supabase
      .from('friend_requests')
      .select('id, sender_id, status')
      .eq('id', id)
      .single()

    if (fetchError || !row) {
      return errorResponse('Friend request not found', 404)
    }

    if (row.sender_id !== user.id) {
      return errorResponse('Forbidden', 403)
    }

    if (row.status !== 'pending') {
      return errorResponse('Request is not pending', 400)
    }

    const { error: deleteError } = await supabase.from('friend_requests').delete().eq('id', id)

    if (deleteError) {
      return errorResponse(deleteError.message, 400)
    }

    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to cancel friend request', 500)
  }
}
