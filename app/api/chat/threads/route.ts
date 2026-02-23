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

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const serviceClient = createServiceClient()

    const { data: participantRows, error: partError } = await serviceClient
      .from('chat_participants')
      .select('thread_id')
      .eq('user_id', user.id)

    if (partError) {
      const isRecursion =
        partError.code === '42P17' ||
        (typeof partError.message === 'string' && partError.message.toLowerCase().includes('infinite recursion'))
      if (isRecursion) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_threads', { user_uuid: user.id })
        if (rpcError) return errorResponse(rpcError.message, 400)
        return jsonResponse({ data: Array.isArray(rpcData) ? rpcData.slice(offset, offset + limit) : [], limit, offset })
      }
      return errorResponse(partError.message, 400)
    }

    if (!participantRows || participantRows.length === 0) {
      return jsonResponse({ data: [], limit, offset })
    }

    const threadIds = [...new Set(participantRows.map((p: any) => p.thread_id))]

    const { data: threads, error: threadError } = await serviceClient
      .from('chat_threads')
      .select(THREAD_SELECT)
      .in('id', threadIds)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (threadError) return errorResponse(threadError.message, 400)
    if (!threads || threads.length === 0) {
      return jsonResponse({ data: [], limit, offset })
    }

    const fetchedThreadIds = threads.map((t: any) => t.id)

    let unreadByThread: Record<string, number> = {}
    const { data: unreadMsgs } = await serviceClient
      .from('chat_messages')
      .select('id, thread_id')
      .in('thread_id', fetchedThreadIds)
      .eq('is_deleted', false)
      .neq('sender_id', user.id)

    if (unreadMsgs && unreadMsgs.length > 0) {
      const messageIds = unreadMsgs.map((m: any) => m.id)
      const { data: readData } = await serviceClient
        .from('message_reads')
        .select('message_id')
        .eq('user_id', user.id)
        .in('message_id', messageIds)

      const readSet = new Set((readData || []).map((r: any) => r.message_id))
      for (const m of unreadMsgs) {
        if (!readSet.has(m.id)) {
          unreadByThread[m.thread_id] = (unreadByThread[m.thread_id] || 0) + 1
        }
      }
    }

    const result = threads.map((t: any) => ({
      ...t,
      unread_count: unreadByThread[t.id] || 0,
    }))

    return jsonResponse({ data: result, limit, offset })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch threads', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json()
    const participantIds = body.participant_ids as string[] | undefined
    const type = (body.type as 'direct' | 'group') || 'direct'
    const title = body.title as string | undefined
    const name = body.name as string | undefined

    if (!participantIds || !Array.isArray(participantIds)) {
      return errorResponse('participant_ids is required and must be an array', 400)
    }

    const allParticipantIds = [...new Set([user.id, ...participantIds])]
    const resolvedType = allParticipantIds.length > 2 ? 'group' : type

    if (resolvedType === 'direct' && allParticipantIds.length === 2) {
      const { data: existingThreads } = await serviceClient
        .from('chat_threads')
        .select('id, chat_participants(user_id)')
        .eq('type', 'direct')

      if (existingThreads && existingThreads.length > 0) {
        const desiredIds = new Set(allParticipantIds)
        for (const thread of existingThreads as any[]) {
          const participantList = thread.chat_participants ?? []
          const threadUserIds = new Set(participantList.map((item: any) => item.user_id))
          if (threadUserIds.size === desiredIds.size && allParticipantIds.every((id) => threadUserIds.has(id))) {
            return jsonResponse({ data: { id: thread.id } }, 201)
          }
        }
      }
    }

    const { data: thread, error: threadError } = await serviceClient
      .from('chat_threads')
      .insert({
        type: resolvedType,
        title: title || null,
        name: name || title || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (threadError || !thread) {
      return errorResponse(threadError?.message || 'Failed to create thread', 400)
    }

    const participants = allParticipantIds.map((userId) => ({
      thread_id: thread.id,
      user_id: userId,
      role: userId === user.id ? 'admin' : 'member',
    }))

    const { error: insertPartError } = await serviceClient
      .from('chat_participants')
      .insert(participants)

    if (insertPartError) {
      await serviceClient.from('chat_threads').delete().eq('id', thread.id)
      return errorResponse(insertPartError.message, 400)
    }

    return jsonResponse({ data: { id: thread.id } }, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to create thread', 500)
  }
}
