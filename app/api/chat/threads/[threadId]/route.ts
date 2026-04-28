import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chatThreadAccess'

const THREAD_SELECT = `
  id,
  type,
  title,
  name,
  banner_url,
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

async function computeUnreadCount(
  serviceClient: ReturnType<typeof createServiceClient>,
  userId: string,
  threadId: string
): Promise<number> {
  const { data: unreadMessages } = await serviceClient
    .from('chat_messages')
    .select('id')
    .eq('thread_id', threadId)
    .eq('is_deleted', false)
    .neq('sender_id', userId)

  if (!unreadMessages || unreadMessages.length === 0) return 0

  const messageIds = unreadMessages.map((m: { id: string }) => m.id)
  const { data: readRows } = await serviceClient
    .from('message_reads')
    .select('message_id')
    .eq('user_id', userId)
    .in('message_id', messageIds)
  const readSet = new Set((readRows || []).map((r: { message_id: string }) => r.message_id))
  return unreadMessages.filter((m: { id: string }) => !readSet.has(m.id)).length
}

function threadToResponseBody(thread: Record<string, unknown>, unread_count: number) {
  const { group_banner, banner_url: threadBanner, ...threadRest } = thread as {
    group_banner?: { banner_url?: string | null } | null
    banner_url?: string | null
  }
  return {
    data: {
      ...threadRest,
      banner_url: threadBanner ?? group_banner?.banner_url ?? null,
      unread_count,
    },
    meta: {
      page: 0,
      pageSize: 1,
      hasMore: false,
    },
  }
}

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

    const unread_count = await computeUnreadCount(serviceClient, user.id, threadId)
    return jsonResponse(threadToResponseBody(thread as Record<string, unknown>, unread_count))
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch thread', 500)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const body = await request.json()
    const allowedFields = ['title', 'name', 'banner_url'] as const
    const updates: Record<string, unknown> = {}

    for (const key of allowedFields) {
      if (body[key] === undefined) continue
      if (key === 'banner_url') {
        if (body[key] === null || body[key] === '') {
          updates[key] = null
        } else if (typeof body[key] === 'string') {
          updates[key] = body[key]
        } else {
          return errorResponse('banner_url must be a string or null', 400)
        }
      } else if (typeof body[key] === 'string' || body[key] === null) {
        updates[key] = body[key]
      } else {
        return errorResponse(`${key} must be a string or null`, 400)
      }
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data: thread, error } = await serviceClient
      .from('chat_threads')
      .update(updates)
      .eq('id', threadId)
      .select(THREAD_SELECT)
      .single()

    if (error || !thread) {
      return errorResponse(error?.message || 'Failed to update thread', 400)
    }

    const unread_count = await computeUnreadCount(serviceClient, user.id, threadId)
    return jsonResponse(threadToResponseBody(thread as Record<string, unknown>, unread_count))
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to update thread', 500)
  }
}
