import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ threadId: string; messageId: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { threadId, messageId } = await context.params
    const { user } = await getAuthenticatedUser(_request)
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

    const { data: message, error: msgError } = await serviceClient
      .from('chat_messages')
      .select('id, sender_id, is_deleted')
      .eq('id', messageId)
      .eq('thread_id', threadId)
      .maybeSingle()

    if (msgError) return errorResponse(msgError.message, 400)
    if (!message) return errorResponse('Message not found', 404)

    const senderId = message.sender_id as string | null | undefined
    const alreadyDeleted = Boolean((message as { is_deleted?: boolean }).is_deleted)
    const canDelete = Boolean(senderId === user.id && !alreadyDeleted)

    return jsonResponse({ canDelete })
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Failed to check delete permission', 500)
  }
}
