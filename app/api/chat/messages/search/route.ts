import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const MESSAGE_SELECT = `
  *,
  sender:profiles!chat_messages_sender_id_fkey(id, username, full_name, avatar_url)
`

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()
    const threadId = searchParams.get('thread_id') || undefined

    if (!q) {
      return errorResponse('q (search term) is required', 400)
    }

    let threadIds: string[] | null = null
    if (threadId) {
      const { data: participant } = await serviceClient
        .from('chat_participants')
        .select('id')
        .eq('thread_id', threadId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!participant) return errorResponse('Thread not found or access denied', 404)
      threadIds = [threadId]
    } else {
      const { data: participantRows } = await serviceClient
        .from('chat_participants')
        .select('thread_id')
        .eq('user_id', user.id)
      threadIds = participantRows ? participantRows.map((p: any) => p.thread_id) : []
    }

    if (!threadIds || threadIds.length === 0) {
      return jsonResponse({ data: [] })
    }

    const { data: messages, error } = await serviceClient
      .from('chat_messages')
      .select(MESSAGE_SELECT)
      .in('thread_id', threadIds)
      .eq('is_deleted', false)
      .ilike('content', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ data: messages || [] })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to search messages', 500)
  }
}
