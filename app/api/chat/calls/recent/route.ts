import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const CALL_TYPES = ['call_request', 'call_accepted', 'call_ended', 'call_rejected']

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const { searchParams } = new URL(request.url)
    const parsedLimit = parseInt(searchParams.get('limit') || '10', 10)
    const parsedPage = parseInt(searchParams.get('page') || '0', 10)
    const limit = Number.isNaN(parsedLimit) ? 10 : Math.min(Math.max(parsedLimit, 1), 50)
    const page = Number.isNaN(parsedPage) ? 0 : Math.max(parsedPage, 0)
    const from = page * limit
    const to = from + limit - 1

    const { data: participantRows } = await serviceClient
      .from('chat_participants')
      .select('thread_id')
      .eq('user_id', user.id)

    const threadIds = participantRows ? participantRows.map((p: any) => p.thread_id) : []
    if (threadIds.length === 0) {
      return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
    }

    const { data: callMessages, error } = await serviceClient
      .from('chat_messages')
      .select('id, thread_id, sender_id, message_type, metadata, created_at')
      .in('thread_id', threadIds)
      .in('message_type', CALL_TYPES)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error.message, 400)
    const list = callMessages || []

    const byThread = new Map<string, any>()
    for (const m of list) {
      if (!byThread.has(m.thread_id)) {
        byThread.set(m.thread_id, m)
      }
    }
    const recentAll = [...byThread.values()]
    const recent = recentAll.slice(from, to + 1)

    if (recent.length === 0) {
      return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
    }

    const threadIdsToFetch = recent.map((r: any) => r.thread_id)
    const { data: threads } = await serviceClient
      .from('chat_threads')
      .select('id, type, title, name')
      .in('id', threadIdsToFetch)

    const { data: participants } = await serviceClient
      .from('chat_participants')
      .select('thread_id, user_id, display_name')
      .in('thread_id', threadIdsToFetch)

    const participantUserIds = [...new Set((participants || []).map((p: any) => p.user_id))]
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', participantUserIds)

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))
    const participantsByThread = new Map<string, any[]>()
    for (const p of participants || []) {
      const arr = participantsByThread.get(p.thread_id) || []
      arr.push({
        ...p,
        user: profileMap.get(p.user_id),
      })
      participantsByThread.set(p.thread_id, arr)
    }
    const threadMap = new Map((threads || []).map((t: any) => [t.id, t]))

    const result = recent.map((r: any) => ({
      ...r,
      thread: threadMap.get(r.thread_id),
      participants: participantsByThread.get(r.thread_id) || [],
    }))

    return jsonResponse({
      data: result,
      page,
      pageSize: limit,
      hasMore: recentAll.length > to + 1,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch recent calls', 500)
  }
}
