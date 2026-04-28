import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chatThreadAccess'

type RouteContext = { params: Promise<{ threadId: string; messageId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId, messageId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const { data: message, error: msgError } = await serviceClient
      .from('chat_messages')
      .select('id, sender_id')
      .eq('id', messageId)
      .eq('thread_id', threadId)
      .maybeSingle()

    if (msgError) return errorResponse(msgError.message, 400)
    if (!message) return errorResponse('Message not found', 404)

    if (message.sender_id !== user.id) {
      return errorResponse('Only the sender can delete this message for everyone', 403)
    }

    const now = new Date().toISOString()
    const { error: updateError } = await serviceClient
      .from('chat_messages')
      .update({
        is_deleted: true,
        deleted_at: now,
        updated_at: now,
      })
      .eq('id', messageId)

    if (updateError) return errorResponse(updateError.message, 400)

    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Failed to delete message for everyone', 500)
  }
}
