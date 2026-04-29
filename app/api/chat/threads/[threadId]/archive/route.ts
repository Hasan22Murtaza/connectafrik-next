import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chatThreadAccess'
import {
  CHAT_THREAD_DETAIL_SELECT,
  getMyThreadUnreadCount,
  threadToResponseBody,
} from '@/lib/chatThreadDetail'

type RouteContext = { params: Promise<{ threadId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const body = await request.json()
    const archived = body.archived

    if (typeof archived !== 'boolean') {
      return errorResponse('archived is required and must be a boolean', 400)
    }

    const { data: thread, error } = await serviceClient
      .from('chat_threads')
      .update({ archived })
      .eq('id', threadId)
      .select(CHAT_THREAD_DETAIL_SELECT)
      .single()

    if (error || !thread) {
      return errorResponse(error?.message || 'Failed to update archive state', 400)
    }

    const unread_count = await getMyThreadUnreadCount(serviceClient, user.id, threadId)
    return jsonResponse(threadToResponseBody(thread as Record<string, unknown>, unread_count))
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to archive thread', 500)
  }
}
