import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { filterThreadIdsAccessibleToUser } from '@/lib/chat/chatThreadAccess'
import { loadFriendMaps } from '@/lib/privacy/queries'

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

function asMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
}

function readInvitedIds(meta: Record<string, unknown>): string[] {
  const fromArray = Array.isArray(meta.invitedUserIds)
    ? (meta.invitedUserIds as unknown[]).filter((id): id is string => typeof id === 'string' && Boolean(id))
    : []
  const singles = [meta.targetUserId, meta.target_user_id, meta.lastInvitedUserId]
    .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
    .map((id) => id.trim())
  return [...new Set([...fromArray, ...singles])]
}

type CallRoster = {
  joinedIds: Set<string>
  invitedIds: Set<string>
  allIds: Set<string>
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

    // Mid-call invites create extra sessions on other 1:1 threads that share
    // call_id. Union participants across siblings so history shows everyone.
    const callIds = [
      ...new Set(
        pageRows
          .map((r: { call_id?: string | null }) => (typeof r.call_id === 'string' ? r.call_id.trim() : ''))
          .filter(Boolean)
      ),
    ]
    const { data: siblingRows } = callIds.length
      ? await serviceClient
          .from('call_sessions')
          .select('id, call_id, participants, metadata, created_by, thread_id')
          .in('call_id', callIds)
      : { data: [] as any[] }

    const rosterByCallId = new Map<string, CallRoster>()
    const rosterBySessionId = new Map<string, CallRoster>()

    const ensureRoster = (map: Map<string, CallRoster>, key: string): CallRoster => {
      let roster = map.get(key)
      if (!roster) {
        roster = { joinedIds: new Set(), invitedIds: new Set(), allIds: new Set() }
        map.set(key, roster)
      }
      return roster
    }

    const absorbSession = (roster: CallRoster, row: any) => {
      const meta = asMeta(row.metadata)
      const joined = Array.isArray(row.participants)
        ? (row.participants as string[]).filter(Boolean)
        : []
      for (const id of joined) {
        roster.joinedIds.add(id)
        roster.allIds.add(id)
      }
      if (typeof row.created_by === 'string' && row.created_by) {
        roster.joinedIds.add(row.created_by)
        roster.allIds.add(row.created_by)
      }
      for (const id of readInvitedIds(meta)) {
        roster.invitedIds.add(id)
        roster.allIds.add(id)
      }
    }

    for (const s of siblingRows || []) {
      const callId = typeof s.call_id === 'string' ? s.call_id.trim() : ''
      if (callId) absorbSession(ensureRoster(rosterByCallId, callId), s)
      if (typeof s.id === 'string') absorbSession(ensureRoster(rosterBySessionId, s.id), s)
    }
    for (const r of pageRows) {
      const callId = typeof r.call_id === 'string' ? r.call_id.trim() : ''
      if (callId) absorbSession(ensureRoster(rosterByCallId, callId), r)
      if (typeof r.id === 'string') absorbSession(ensureRoster(rosterBySessionId, r.id), r)
    }

    const threadIdsToFetch = [
      ...new Set([
        ...pageRows.map((r: { thread_id: string }) => r.thread_id),
        ...(siblingRows || []).map((r: { thread_id: string }) => r.thread_id),
      ]),
    ]
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

    const threadParticipantIds = [...new Set((participants || []).map((p: any) => p.user_id))]
    const rosterUserIds = [
      ...new Set(
        [...rosterByCallId.values(), ...rosterBySessionId.values()].flatMap((roster) => [...roster.allIds])
      ),
    ]
    const creatorIds = pageRows
      .map((r: any) => (typeof r.created_by === 'string' ? r.created_by : null))
      .filter(Boolean) as string[]
    const participantUserIds = [...new Set([...threadParticipantIds, ...rosterUserIds, ...creatorIds])]
    const [{ data: profiles }, friendMaps] = await Promise.all([
      participantUserIds.length
        ? serviceClient
            .from('profiles')
            .select('id, username, full_name, avatar_url, status, last_seen')
            .in('id', participantUserIds)
        : Promise.resolve({ data: [] as any[] }),
      loadFriendMaps(user.id, participantUserIds, serviceClient),
    ])

    const threadMap = new Map((threads || []).map((t: any) => [t.id, t]))
    const participantsByThread = new Map<string, string[]>()
    for (const p of participants || []) {
      const arr = participantsByThread.get(p.thread_id) || []
      arr.push(p.user_id)
      participantsByThread.set(p.thread_id, arr)
    }
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

    const toParticipantProfile = (id: string, joined: boolean) => {
      const profile = profileMap.get(id)
      return {
        id,
        name: profile?.full_name || profile?.username || 'Unknown',
        avatar_url: profile?.avatar_url || null,
        joined,
        is_self: id === user.id,
        is_friend: id !== user.id && friendMaps.accepted.has(id),
      }
    }

    const result = pageRows.map((r: any) => {
      const thread = threadMap.get(r.thread_id)
      const threadParticipantIdsForRow = participantsByThread.get(r.thread_id) || []
      const callId = typeof r.call_id === 'string' ? r.call_id.trim() : ''
      const roster =
        (callId ? rosterByCallId.get(callId) : undefined) ||
        (typeof r.id === 'string' ? rosterBySessionId.get(r.id) : undefined)

      const sessionJoinedIds = roster
        ? [...roster.joinedIds]
        : Array.isArray(r.participants)
          ? (r.participants as string[]).filter(Boolean)
          : []
      const invitedIds = roster ? [...roster.invitedIds] : readInvitedIds(asMeta(r.metadata))

      const callParticipantIds =
        sessionJoinedIds.length > 0 || invitedIds.length > 0
          ? [...new Set([...sessionJoinedIds, ...invitedIds])]
          : [
              ...new Set(
                [r.created_by, ...threadParticipantIdsForRow].filter(
                  (id): id is string => typeof id === 'string' && Boolean(id)
                )
              ),
            ]

      const otherId =
        callParticipantIds.find((id: string) => id !== user.id) ||
        threadParticipantIdsForRow.find((id: string) => id !== user.id) ||
        null
      const otherProfile = otherId ? profileMap.get(otherId) : null
      const contactName =
        otherProfile?.full_name ||
        otherProfile?.username ||
        thread?.title ||
        thread?.name ||
        'Unknown'

      const meta = asMeta(r.metadata)
      const displayAt = r.ended_at || r.updated_at || r.created_at
      const sessionId =
        typeof r.id === 'string' ? r.id : r.call_id ? `${r.thread_id}:${r.call_id}` : `${r.thread_id}:${displayAt}`
      const joinedSet = new Set(sessionJoinedIds)
      const callParticipants = callParticipantIds.map((id: string) =>
        toParticipantProfile(id, joinedSet.size === 0 ? true : joinedSet.has(id))
      )

      const isMultiParty =
        callParticipants.filter((p) => !p.is_self).length > 1 ||
        meta.isGroupCall === true ||
        meta.isGroupCall === 'true'

      return {
        session_id: sessionId,
        thread_id: r.thread_id,
        created_at: displayAt,
        message_type: statusToMessageType(r.status),
        call_direction: resolveCallDirection(user.id, r.created_by, r.status),
        call_type: r.call_type === 'video' ? 'video' : 'audio',
        metadata: { ...meta, callType: r.call_type || meta.callType, isGroupCall: isMultiParty },
        thread_name: thread?.title || thread?.name || null,
        thread_type: isMultiParty ? 'group' : thread?.type ?? null,
        contact_id: otherId,
        contact_name: contactName,
        contact_avatar_url: otherProfile?.avatar_url || null,
        contact_status: otherProfile?.status || 'offline',
        contact_last_seen: otherProfile?.last_seen || null,
        banner_url: thread?.banner_url ?? null,
        created_by: r.created_by ?? null,
        participants: callParticipants,
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
