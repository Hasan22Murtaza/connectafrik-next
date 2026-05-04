import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { filterThreadIdsAccessibleToUser } from '@/lib/chatThreadAccess'

/** Align API message_type with call_sessions.status (Postgres check constraint). */
function statusToMessageType(status: string | null | undefined): string {
  const s = (status || '').trim()
  if (['initiated', 'ringing', 'active', 'ended', 'failed', 'missed', 'declined'].includes(s)) {
    return s
  }
  return 'ringing'
}

function toTime(value: string | null | undefined): number {
  const t = value ? new Date(value).getTime() : 0
  return Number.isNaN(t) ? 0 : t
}

type CallDirection = 'outgoing' | 'incoming' | 'missed'

function resolveCallDirection(
  userId: string,
  createdBy: string | null | undefined,
  status: string | null | undefined
): CallDirection {
  const creator = (createdBy || '').trim()
  const s = (status || '').trim()
  if (creator === userId) return 'outgoing'
  if (s === 'missed' || s === 'declined') return 'missed'
  return 'incoming'
}

/** WhatsApp-style chronological call log: one row per call session (paginated). */
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
    const to = from + limit

    const { data: participantRows } = await serviceClient
      .from('chat_participants')
      .select('thread_id')
      .eq('user_id', user.id)

    const rawThreadIds = participantRows ? participantRows.map((p: { thread_id: string }) => p.thread_id) : []
    const threadIds = await filterThreadIdsAccessibleToUser(serviceClient, user.id, rawThreadIds)
    if (threadIds.length === 0) {
      return jsonResponse({
        data: [],
        meta: { page, pageSize: limit, hasMore: false },
      })
    }

    const { data: sessionRows, error } = await serviceClient
      .from('call_sessions')
      .select(
        'id, thread_id, status, call_type, metadata, started_at, ended_at, updated_at, created_at, created_by, call_id'
      )
      .in('thread_id', threadIds)
      .order('updated_at', { ascending: false })
      .range(from, to)

    if (error) return errorResponse(error.message, 400)

    const rows = sessionRows || []
    const hasMore = rows.length > limit
    const pageRows = hasMore ? rows.slice(0, limit) : rows

    if (pageRows.length === 0) {
      return jsonResponse({
        data: [],
        meta: { page, pageSize: limit, hasMore },
      })
    }

    const threadIdsToFetch = [...new Set(pageRows.map((r: { thread_id: string }) => r.thread_id))]
    const { data: threadsRaw } = await serviceClient
      .from('chat_threads')
      .select(
        `
        id,
        type,
        title,
        name,
        group_id,
        group_banner:groups!chat_threads_group_id_fkey(banner_url)
      `
      )
      .in('id', threadIdsToFetch)

    const threads = (threadsRaw || []).map((t: any) => {
      const { group_banner, ...rest } = t
      return {
        ...rest,
        banner_url: group_banner?.banner_url ?? null,
      }
    })

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

    const result = pageRows.map((r: any) => {
      const thread = threadMap.get(r.thread_id)
      const participantIds = participantsByThread.get(r.thread_id) || []
      const otherId = participantIds.find((id: string) => id !== user.id) || null
      const otherProfile = otherId ? profileMap.get(otherId) : null
      const contactName =
        otherProfile?.full_name ||
        otherProfile?.username ||
        thread?.title ||
        thread?.name ||
        'Unknown'

      const meta = (r.metadata && typeof r.metadata === 'object' ? r.metadata : {}) as Record<string, unknown>
      const displayAt = r.ended_at || r.updated_at || r.created_at
      const sessionId = typeof r.id === 'string' ? r.id : r.call_id ? `${r.thread_id}:${r.call_id}` : `${r.thread_id}:${displayAt}`

      return {
        session_id: sessionId,
        thread_id: r.thread_id,
        created_at: displayAt,
        message_type: statusToMessageType(r.status),
        call_direction: resolveCallDirection(user.id, r.created_by, r.status),
        call_type: r.call_type === 'video' ? 'video' : 'audio',
        metadata: { ...meta, callType: r.call_type || meta.callType },
        thread_name: thread?.title || thread?.name || null,
        thread_type: thread?.type ?? null,
        contact_id: otherId,
        contact_name: contactName,
        contact_avatar_url: otherProfile?.avatar_url || null,
        contact_status: otherProfile?.status || 'offline',
        contact_last_seen: otherProfile?.last_seen || null,
        banner_url: thread?.banner_url ?? null,
        created_by: r.created_by ?? null,
      }
    })
    result.sort((a, b) => toTime(b.created_at) - toTime(a.created_at))

    return jsonResponse({
      data: result,
      meta: {
        page,
        pageSize: limit,
        hasMore,
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch call history', 500)
  }
}
