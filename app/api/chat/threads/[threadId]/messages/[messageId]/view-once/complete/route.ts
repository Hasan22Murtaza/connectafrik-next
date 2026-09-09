import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chat/chatThreadAccess'
import { requireUnlockedLockedThread } from '@/lib/chat/chatLock'
import { consumeViewOnceStorage } from '@/lib/chat/chatViewOnce'

export const runtime = 'nodejs'

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

    const lockedDenial = await requireUnlockedLockedThread(request, serviceClient, user.id, threadId)
    if (lockedDenial) return lockedDenial

    const { data: message, error: msgError } = await serviceClient
      .from('chat_messages')
      .select('id, view_once, view_once_opened, view_once_opened_by, is_deleted')
      .eq('id', messageId)
      .eq('thread_id', threadId)
      .maybeSingle()

    if (msgError) return errorResponse(msgError.message, 400)
    if (!message || message.is_deleted) return errorResponse('Message not found', 404)
    if (!message.view_once) {
      return errorResponse('This message is not a View Once message', 400)
    }
    if (!message.view_once_opened || message.view_once_opened_by !== user.id) {
      return errorResponse('Not allowed to complete this View Once session', 403)
    }

    await consumeViewOnceStorage(serviceClient, messageId)
    return jsonResponse({ data: { consumed: true } })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to complete View Once session', 500)
  }
}
