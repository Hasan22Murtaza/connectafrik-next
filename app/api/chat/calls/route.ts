import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { filterThreadIdsAccessibleToUser } from '@/lib/chat/chatThreadAccess'

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
        'id, thread_id, status, call_type, metadata, started_at, ended_at, updated_at, created_at, created_by, call_id, participants'
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

    const pageCallIds = [
      ...new Set(pageRows.map((r: { call_id?: string }) => (typeof r.call_id === 'string' ? r.call_id : '')).filter(Boolean)),
    ]
    const { data: relatedRows } = pageCallIds.length
      ? await serviceClient
          .from('call_sessions')
          .select('id, thread_id, status, call_type, metadata, started_at, ended_at, updated_at, created_at, created_by, call_id, participants')
          .in('call_id', pageCallIds)
          .in('thread_id', threadIds)
      : { data: [] as any[] }

    const relatedByCallId = new Map<string, any[]>()
    for (const s of relatedRows || []) {
      const cid = typeof s.call_id === 'string' ? s.call_id : ''
      if (!cid) continue
      const arr = relatedByCallId.get(cid) || []
      arr.push(s)
      relatedByCallId.set(cid, arr)
    }

    const allRelated = [...pageRows, ...(relatedRows || [])]
    const threadIdsToFetch = [...new Set(allRelated.map((r: { thread_id: string }) => r.thread_id))]
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

    const callUserIds = new Set<string>()
    for (const s of allRelated) {
      if (typeof s.created_by === 'string') callUserIds.add(s.created_by)
      if (Array.isArray(s.participants)) {
        for (const id of s.participants) if (typeof id === 'string') callUserIds.add(id)
      }
      const meta = s.metadata && typeof s.metadata === 'object' ? (s.metadata as Record<string, unknown>) : {}
      if (typeof meta.targetUserId === 'string') callUserIds.add(meta.targetUserId)
      if (typeof meta.target_user_id === 'string') callUserIds.add(meta.target_user_id)
      const extraIds = Array.isArray(meta.callParticipantIds) ? meta.callParticipantIds : []
      for (const id of extraIds) if (typeof id === 'string') callUserIds.add(id)
    }
    const participantUserIds = [
      ...new Set([...(participants || []).map((p: any) => p.user_id), ...callUserIds]),
    ]
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

    function formatOtherNames(others: Array<{ name: string }>): string {
      const names = others.map((o) => o.name).filter(Boolean)
      if (names.length === 0) return 'Unknown'
      if (names.length === 1) return names[0]
      if (names.length === 2) return `${names[0]} & ${names[1]}`
      if (names.length === 3) return `${names[0]}, ${names[1]} & ${names[2]}`
      return `${names[0]}, ${names[1]} & ${names.length - 2} others`
    }

    const emittedCallIds = new Set<string>()
    const result: any[] = []
    for (const r of pageRows as any[]) {
      const callKey = typeof r.call_id === 'string' && r.call_id ? r.call_id : r.id
      if (emittedCallIds.has(callKey)) continue
      emittedCallIds.add(callKey)

      const group = relatedByCallId.get(callKey) || [r]
      const primary =
        group.find((s) => {
          const meta = s.metadata && typeof s.metadata === 'object' ? (s.metadata as Record<string, unknown>) : {}
          return meta.isCallInvite !== true
        }) || group[0] || r

      const otherIds = new Set<string>()
      let isGroupCall = false
      for (const s of group) {
        const meta = (s.metadata && typeof s.metadata === 'object' ? s.metadata : {}) as Record<string, unknown>
        if (meta.isGroupCall === true || meta.isCallInvite === true) isGroupCall = true
        if (typeof s.created_by === 'string' && s.created_by !== user.id) otherIds.add(s.created_by)
        if (Array.isArray(s.participants)) {
          for (const id of s.participants) if (typeof id === 'string' && id !== user.id) otherIds.add(id)
        }
        if (typeof meta.targetUserId === 'string' && meta.targetUserId !== user.id) otherIds.add(meta.targetUserId)
        if (typeof meta.target_user_id === 'string' && meta.target_user_id !== user.id) otherIds.add(meta.target_user_id)
        const extraIds = Array.isArray(meta.callParticipantIds) ? meta.callParticipantIds : []
        for (const id of extraIds) if (typeof id === 'string' && id !== user.id) otherIds.add(id)
      }
      const thread = threadMap.get(primary.thread_id)
      const threadParticipantIds = participantsByThread.get(primary.thread_id) || []
      for (const id of threadParticipantIds) if (id !== user.id) otherIds.add(id)

      const otherParticipants = Array.from(otherIds).map((id) => {
        const profile = profileMap.get(id)
        return {
          id,
          name: profile?.full_name || profile?.username || 'Unknown',
          avatar_url: profile?.avatar_url || null,
        }
      })
      if (otherParticipants.length > 1) isGroupCall = true

      const otherId = otherParticipants[0]?.id || null
      const otherProfile = otherId ? profileMap.get(otherId) : null
      const contactName = isGroupCall
        ? (thread?.type === 'group' ? thread?.title || thread?.name : null) || formatOtherNames(otherParticipants)
        : otherProfile?.full_name ||
          otherProfile?.username ||
          thread?.title ||
          thread?.name ||
          'Unknown'

      const meta = (primary.metadata && typeof primary.metadata === 'object' ? primary.metadata : {}) as Record<string, unknown>
      const displayAt = primary.ended_at || primary.updated_at || primary.created_at
      const sessionId =
        typeof primary.call_id === 'string' && primary.call_id
          ? primary.call_id
          : typeof primary.id === 'string'
            ? primary.id
            : `${primary.thread_id}:${displayAt}`

      result.push({
        session_id: sessionId,
        thread_id: primary.thread_id,
        created_at: displayAt,
        message_type: statusToMessageType(primary.status),
        call_direction: resolveCallDirection(user.id, primary.created_by, primary.status),
        call_type: primary.call_type === 'video' ? 'video' : 'audio',
        metadata: { ...meta, callType: primary.call_type || meta.callType, isGroupCall },
        thread_name: thread?.title || thread?.name || null,
        thread_type: thread?.type ?? null,
        contact_id: otherId,
        contact_name: contactName,
        contact_avatar_url: otherProfile?.avatar_url || null,
        contact_status: otherProfile?.status || 'offline',
        contact_last_seen: otherProfile?.last_seen || null,
        banner_url: thread?.banner_url ?? null,
        created_by: primary.created_by ?? null,
        is_group_call: isGroupCall,
        other_participants: otherParticipants,
      })
    }
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
