import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const THREAD_SELECT = `
  *,
  chat_participants(
    user_id,
    user:profiles!user_id(id, username, full_name, avatar_url)
  )
`

type RouteContext = { params: Promise<{ threadId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
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

    const { data: thread, error } = await serviceClient
      .from('chat_threads')
      .select(THREAD_SELECT)
      .eq('id', threadId)
      .single()

    if (error || !thread) {
      return errorResponse('Thread not found', 404)
    }

    const { data: unreadMessages } = await serviceClient
      .from('chat_messages')
      .select('id')
      .eq('thread_id', threadId)
      .eq('is_deleted', false)
      .neq('sender_id', user.id)

    let unread_count = 0
    if (unreadMessages && unreadMessages.length > 0) {
      const messageIds = unreadMessages.map((m: any) => m.id)
      const { data: readRows } = await serviceClient
        .from('message_reads')
        .select('message_id')
        .eq('user_id', user.id)
        .in('message_id', messageIds)
      const readSet = new Set((readRows || []).map((r: any) => r.message_id))
      unread_count = unreadMessages.filter((m: any) => !readSet.has(m.id)).length
    }

    return jsonResponse({
      data: {
        ...thread,
        unread_count,
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch thread', 500)
  }
}
