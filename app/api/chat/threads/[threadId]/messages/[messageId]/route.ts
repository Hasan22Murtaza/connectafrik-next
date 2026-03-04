import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ threadId: string; messageId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { threadId, messageId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const { data: participant } = await serviceClient
      .from('chat_participants')
      .select('id')
      .eq('thread_id', threadId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!participant) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const { data: canDelete, error } = await serviceClient.rpc('can_delete_for_everyone', {
      p_message_id: messageId,
      p_user_id: user.id,
    })

    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ data: { can_delete_for_everyone: !!canDelete } })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to check delete permission', 500)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { threadId, messageId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json()
    const action = body.action as 'delete_for_me' | 'delete_for_everyone' | undefined

    const { data: participant } = await serviceClient
      .from('chat_participants')
      .select('id')
      .eq('thread_id', threadId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!participant) {
      return errorResponse('Thread not found or access denied', 404)
    }

    if (action === 'delete_for_me') {
      const { error } = await serviceClient.rpc('delete_message_for_user', {
        p_message_id: messageId,
        p_user_id: user.id,
      })
      if (error) return errorResponse(error.message, 400)
      return jsonResponse({ success: true })
    }

    if (action === 'delete_for_everyone') {
      const { error } = await serviceClient.rpc('delete_message_for_everyone', {
        p_message_id: messageId,
        p_user_id: user.id,
      })
      if (error) return errorResponse(error.message, 400)
      return jsonResponse({ success: true })
    }

    return errorResponse('Invalid action', 400)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to update message', 500)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { threadId, messageId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const { data: msg } = await serviceClient
      .from('chat_messages')
      .select('id, sender_id')
      .eq('id', messageId)
      .eq('thread_id', threadId)
      .single()

    if (!msg) return errorResponse('Message not found', 404)
    if (msg.sender_id !== user.id) return errorResponse('Only the sender can delete this message', 403)

    const { error } = await serviceClient
      .from('chat_messages')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', messageId)

    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to delete message', 500)
  }
}
