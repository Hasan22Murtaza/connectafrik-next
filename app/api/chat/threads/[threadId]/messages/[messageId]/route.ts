import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chatThreadAccess'

const MESSAGE_SELECT = `
  *,
  sender:profiles!chat_messages_sender_id_fkey(id, username, full_name, avatar_url)
`

type RouteContext = { params: Promise<{ threadId: string; messageId: string }> }

const enrichMessageResponse = async (serviceClient: any, message: any, fallbackReaderId: string) => {
  const [readsRes, attachmentsRes] = await Promise.all([
    serviceClient.from('message_reads').select('user_id').eq('message_id', message.id),
    serviceClient.from('message_attachments').select('*').eq('message_id', message.id),
  ])
  const readBy = (readsRes.data || []).map((r: any) => r.user_id)
  return {
    ...message,
    read_by: readBy.length ? readBy : [fallbackReaderId],
    attachments: attachmentsRes.data || [],
    reactions: [],
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { threadId, messageId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const { data: msg, error: msgError } = await serviceClient
      .from('chat_messages')
      .select('sender_id, is_deleted')
      .eq('id', messageId)
      .eq('thread_id', threadId)
      .maybeSingle()

    if (msgError) return errorResponse(msgError.message, 400)
    if (!msg) return errorResponse('Message not found', 404)

    const canDelete =
      msg.sender_id === user.id && !Boolean((msg as { is_deleted?: boolean }).is_deleted)
    return jsonResponse({ data: { can_delete_for_everyone: canDelete } })
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
    const content = body.content
    const isForwardFlag = body.is_forward

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    if (typeof content !== 'string') {
      return errorResponse('content must be a string', 400)
    }
    const safeContent = content.trim()
    if (!safeContent) {
      return errorResponse('content cannot be empty', 400)
    }

    const { data: existing, error: fetchError } = await serviceClient
      .from('chat_messages')
      .select('id, sender_id, thread_id, message_type, is_deleted')
      .eq('id', messageId)
      .eq('thread_id', threadId)
      .maybeSingle()

    if (fetchError) return errorResponse(fetchError.message, 400)
    if (!existing) return errorResponse('Message not found', 404)
    if (existing.sender_id !== user.id) {
      return errorResponse('Only the sender can edit this message', 403)
    }
    if (existing.is_deleted) {
      return errorResponse('Cannot edit a deleted message', 400)
    }
    const type = existing.message_type || 'text'
    if (type !== 'text') {
      return errorResponse('Only text messages can be edited', 400)
    }

    const now = new Date().toISOString()
    const updateRow: Record<string, unknown> = {
      content: safeContent,
      updated_at: now,
      is_edited: true,
    }
    if (typeof isForwardFlag === 'boolean') {
      updateRow.is_forward = isForwardFlag
    }
    const { data: updated, error: updateError } = await serviceClient
      .from('chat_messages')
      .update(updateRow)
      .eq('id', messageId)
      .eq('thread_id', threadId)
      .select(MESSAGE_SELECT)
      .single()

    if (updateError || !updated) {
      return errorResponse(updateError?.message || 'Failed to update message', 400)
    }

    const { data: latest } = await serviceClient
      .from('chat_messages')
      .select('id')
      .eq('thread_id', threadId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latest?.id === messageId) {
      const preview = safeContent.length > 100 ? safeContent.slice(0, 97) + '...' : safeContent
      await serviceClient
        .from('chat_threads')
        .update({
          last_message_preview: preview,
          last_message_at: now,
          last_activity_at: now,
          updated_at: now,
        })
        .eq('id', threadId)
    }

    const data = await enrichMessageResponse(serviceClient, updated, user.id)
    return jsonResponse({ data })
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

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

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
      .eq('thread_id', threadId)

    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to delete message', 500)
  }
}
