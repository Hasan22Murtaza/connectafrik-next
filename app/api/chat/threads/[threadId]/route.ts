import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chatThreadAccess'

const THREAD_SELECT = `
  id,
  type,
  title,
  name,
  group_id,
  group_banner:groups!chat_threads_group_id_fkey(banner_url),
  last_message_preview,
  last_message_at,
  last_activity_at,
  created_at,
  updated_at,
  chat_participants(
    user:profiles!user_id(id, username, full_name, avatar_url, status, last_seen)
  )
`

type RouteContext = { params: Promise<{ threadId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
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

    const { group_banner, ...threadRest } = thread as any
    return jsonResponse({
      data: {
        ...threadRest,
        banner_url: group_banner?.banner_url ?? null,
        unread_count,
      },
      meta: {
        page: 0,
        pageSize: 1,
        hasMore: false,
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch thread', 500)
  }
}
