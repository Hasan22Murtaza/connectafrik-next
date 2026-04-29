import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chatThreadAccess'

type RouteContext = { params: Promise<{ threadId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json()
    const messageIds = body.message_ids as string[] | undefined

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return errorResponse('message_ids is required and must be a non-empty array', 400)
    }

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const { data: othersMessages } = await serviceClient
      .from('chat_messages')
      .select('id')
      .eq('thread_id', threadId)
      .in('id', messageIds)
      .neq('sender_id', user.id)

    const relevantIds = (othersMessages || []).map((m: { id: string }) => m.id)
    let newlyRead = 0
    if (relevantIds.length > 0) {
      const { data: alreadyRead } = await serviceClient
        .from('message_reads')
        .select('message_id')
        .eq('user_id', user.id)
        .in('message_id', relevantIds)
      const seen = new Set((alreadyRead || []).map((r: { message_id: string }) => r.message_id))
      newlyRead = relevantIds.filter((id) => !seen.has(id)).length
    }

    const rows = messageIds.map((message_id: string) => ({
      message_id,
      user_id: user.id,
    }))

    const { error } = await serviceClient.from('message_reads').upsert(rows, {
      onConflict: 'message_id,user_id',
    })

    if (error) return errorResponse(error.message, 400)

    if (newlyRead > 0) {
      const { data: part } = await serviceClient
        .from('chat_participants')
        .select('unread_count')
        .eq('thread_id', threadId)
        .eq('user_id', user.id)
        .maybeSingle()
      const cur = typeof part?.unread_count === 'number' ? part.unread_count : 0
      const next = Math.max(0, cur - newlyRead)
      const { error: partErr } = await serviceClient
        .from('chat_participants')
        .update({ unread_count: next })
        .eq('thread_id', threadId)
        .eq('user_id', user.id)
      if (partErr) return errorResponse(partErr.message, 400)

      const { error: syncErr } = await serviceClient.rpc('chat_sync_thread_unread_aggregate', {
        p_thread_id: threadId,
      })
      if (syncErr) console.error('chat_sync_thread_unread_aggregate', syncErr)
    }

    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to mark as read', 500)
  }
}
