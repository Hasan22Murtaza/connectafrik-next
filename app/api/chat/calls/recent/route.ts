import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

/** Align API message_type with call_sessions.status (Postgres check constraint). */
function statusToMessageType(status: string | null | undefined): string {
  const s = (status || '').trim()
  if (['initiated', 'ringing', 'active', 'ended', 'failed', 'missed', 'declined'].includes(s)) {
    return s
  }
  return 'ringing'
}

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
      return jsonResponse({
        data: [],
        meta: { page, pageSize: limit, hasMore: false },
      })
    }

    const { data: sessions, error } = await serviceClient
      .from('call_sessions')
      .select('thread_id, status, call_type, metadata, started_at, ended_at, updated_at, created_at')
      .in('thread_id', threadIds)
      .order('updated_at', { ascending: false })

    if (error) return errorResponse(error.message, 400)
    const list = sessions || []

    const byThread = new Map<string, any>()
    for (const s of list) {
      const existing = byThread.get(s.thread_id)
      const t = new Date(s.updated_at || s.created_at).getTime()
      const et = existing ? new Date(existing.updated_at || existing.created_at).getTime() : 0
      if (!existing || t > et) {
        byThread.set(s.thread_id, s)
      }
    }

    const recentAll = [...byThread.values()].sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    )
    const recent = recentAll.slice(from, to + 1)

    if (recent.length === 0) {
      return jsonResponse({
        data: [],
        meta: { page, pageSize: limit, hasMore: false },
      })
    }

    const threadIdsToFetch = [...new Set(recent.map((r: any) => r.thread_id))]
    const { data: threads } = await serviceClient
      .from('chat_threads')
      .select('id, type, title, name')
      .in('id', threadIdsToFetch)

    const { data: participants } = await serviceClient
      .from('chat_participants')
      .select('thread_id, user_id')
      .in('thread_id', threadIdsToFetch)

    const participantUserIds = [...new Set((participants || []).map((p: any) => p.user_id))]
    const { data: profiles } = participantUserIds.length
      ? await serviceClient
          .from('profiles')
          .select('id, username, full_name, avatar_url, status, last_seen')
          .in('id', participantUserIds)
      : { data: [] as any[] }

    const threadMap = new Map((threads || []).map((t: any) => [t.id, t]))
    const participantsByThread = new Map<string, string[]>()
    for (const p of participants || []) {
      const arr = participantsByThread.get(p.thread_id) || []
      arr.push(p.user_id)
      participantsByThread.set(p.thread_id, arr)
    }
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

    const result = recent
      .map((r: any) => {
        const thread = threadMap.get(r.thread_id)
        const participantIds = participantsByThread.get(r.thread_id) || []
        const otherId = participantIds.find((id) => id !== user.id) || null
        const otherProfile = otherId ? profileMap.get(otherId) : null
        const contactName =
          otherProfile?.full_name ||
          otherProfile?.username ||
          thread?.title ||
          thread?.name ||
          'Unknown'

        const meta = (r.metadata && typeof r.metadata === 'object' ? r.metadata : {}) as Record<string, unknown>
        return {
          thread_id: r.thread_id,
          created_at: r.updated_at || r.created_at,
          message_type: statusToMessageType(r.status),
          metadata: { ...meta, callType: r.call_type || meta.callType },
          thread_name: thread?.title || thread?.name || null,
          contact_id: otherId,
          contact_name: contactName,
          contact_avatar_url: otherProfile?.avatar_url || null,
          contact_status: otherProfile?.status || 'offline',
          contact_last_seen: otherProfile?.last_seen || null,
        }
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return jsonResponse({
      data: result,
      meta: {
        page,
        pageSize: limit,
        hasMore: recentAll.length > to + 1,
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch recent calls', 500)
  }
}
