import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { filterThreadIdsAccessibleToUser } from '@/lib/chatThreadAccess'

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
    user_id,
    user:profiles!user_id(id, username, full_name, avatar_url, status, last_seen)
  )
`

const mapRpcRowsToThreadShape = (rows: any[]) => {
  return rows.map((row: any) => {
    const lastTimestamp = row.last_message_at ?? new Date().toISOString()
    return {
      id: row.thread_id,
      type: row.thread_type,
      title: row.thread_name,
      name: row.thread_name,
      archived: false,
      last_message_preview: row.last_message_content,
      last_message_at: lastTimestamp,
      last_activity_at: lastTimestamp,
      created_at: lastTimestamp,
      updated_at: lastTimestamp,
      unread_count: 0,
      chat_participants: Array.isArray(row.participants)
        ? row.participants.map((participant: any) => ({
            user_id: participant.id,
            user: {
              id: participant.id,
              username: participant.name ?? null,
              full_name: participant.name ?? null,
              avatar_url: participant.avatar_url ?? null,
              status: participant.status ?? 'offline',
              last_seen: participant.last_seen ?? null,
            },
          }))
        : [],
    }
  })
}

async function getParticipantPrefsForThreads(
  serviceClient: ReturnType<typeof createServiceClient>,
  userId: string,
  threadIds: string[]
): Promise<
  Map<
    string,
    {
      unread_count: number
      pinned: boolean
      pinned_at: string | null
      archived: boolean
    }
  >
> {
  if (threadIds.length === 0) return new Map()
  const { data } = await serviceClient
    .from('chat_participants')
    .select('thread_id, unread_count, pinned, pinned_at, archived')
    .eq('user_id', userId)
    .in('thread_id', threadIds)
  const m = new Map<
    string,
    { unread_count: number; pinned: boolean; pinned_at: string | null; archived: boolean }
  >()
  for (const row of data ?? []) {
    const tid = row.thread_id as string
    m.set(tid, {
      unread_count: typeof row.unread_count === 'number' ? row.unread_count : 0,
      pinned: Boolean(row.pinned),
      pinned_at: typeof row.pinned_at === 'string' ? row.pinned_at : null,
      archived: Boolean(row.archived),
    })
  }
  return m
}

const getThreadActivityTime = (thread: any) => {
  const timestamp = thread?.last_activity_at ?? thread?.last_message_at ?? thread?.updated_at ?? thread?.created_at
  const time = timestamp ? new Date(timestamp).getTime() : 0
  return Number.isNaN(time) ? 0 : time
}

const deduplicateThreadsByParticipants = (threads: any[]) => {
  const dedupedByMembers = new Map<string, any>()
  const passthroughThreads: any[] = []

  for (const thread of threads) {
    const threadType = thread?.type
    if (threadType !== 'group' && threadType !== 'direct') {
      passthroughThreads.push(thread)
      continue
    }

    const participantIds = Array.isArray(thread?.chat_participants)
      ? thread.chat_participants
          .map((participant: any) => participant?.user_id)
          .filter((id: any): id is string => typeof id === 'string' && id.length > 0)
      : []

    if (participantIds.length === 0) {
      passthroughThreads.push(thread)
      continue
    }

    const key = `${threadType}:${[...new Set(participantIds)].sort().join(':')}`
    const existing = dedupedByMembers.get(key)
    if (!existing || getThreadActivityTime(thread) > getThreadActivityTime(existing)) {
      dedupedByMembers.set(key, thread)
    }
  }

  return [...passthroughThreads, ...Array.from(dedupedByMembers.values())].sort(
    (a: any, b: any) => getThreadActivityTime(b) - getThreadActivityTime(a)
  )
}

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const parsedLimit = parseInt(searchParams.get('limit') || '50', 10)
    const parsedPage = parseInt(searchParams.get('page') || '0', 10)
    const groupId = searchParams.get('group_id') || undefined
    const limit = Number.isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 100)
    const page = Number.isNaN(parsedPage) ? 0 : Math.max(parsedPage, 0)
    const from = page * limit
    const to = from + limit - 1

    const serviceClient = createServiceClient()

    const { data: participantRows, error: partError } = await serviceClient
      .from('chat_participants')
      .select('thread_id, unread_count, pinned, pinned_at, archived')
      .eq('user_id', user.id)

    if (partError) {
      const isRecursion =
        partError.code === '42P17' ||
        (typeof partError.message === 'string' && partError.message.toLowerCase().includes('infinite recursion'))
      if (isRecursion) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_threads', { user_uuid: user.id })
        if (rpcError) return errorResponse(rpcError.message, 400)
        const rows = Array.isArray(rpcData) ? rpcData : []
        const normalized = mapRpcRowsToThreadShape(rows)
        const deduped = deduplicateThreadsByParticipants(normalized)
        const rpcPrefs = await getParticipantPrefsForThreads(
          serviceClient,
          user.id,
          deduped.map((t: { id?: string }) => t.id).filter((id): id is string => typeof id === 'string')
        )
        for (const t of deduped) {
          const id = typeof t?.id === 'string' ? t.id : ''
          const pref = id ? rpcPrefs.get(id) : undefined
          t.unread_count = pref?.unread_count ?? 0
          t.pinned = pref?.pinned ?? false
          t.pinned_at = pref?.pinned_at ?? null
          t.archived = pref?.archived ?? false
        }
        return jsonResponse({
          data: deduped.slice(from, to + 1),
          meta: {
            page,
            pageSize: limit,
            hasMore: deduped.length > to + 1,
          },
        })
      }
      return errorResponse(partError.message, 400)
    }

    if (!participantRows || participantRows.length === 0) {
      return jsonResponse({
        data: [],
        meta: { page, pageSize: limit, hasMore: false },
      })
    }

    const myPrefsByThreadId = new Map(
      participantRows.map(
        (p: {
          thread_id: string
          unread_count?: number | null
          pinned?: boolean | null
          pinned_at?: string | null
          archived?: boolean | null
        }) => [
          p.thread_id,
          {
            unread_count: typeof p.unread_count === 'number' ? p.unread_count : 0,
            pinned: Boolean(p.pinned),
            pinned_at: typeof p.pinned_at === 'string' ? p.pinned_at : null,
            archived: Boolean(p.archived),
          },
        ]
      )
    )

    const rawThreadIds = [...new Set(participantRows.map((p: { thread_id: string }) => p.thread_id))]
    const threadIds = await filterThreadIdsAccessibleToUser(serviceClient, user.id, rawThreadIds)
    if (threadIds.length === 0) {
      return jsonResponse({
        data: [],
        meta: { page, pageSize: limit, hasMore: false },
      })
    }

    let threads: any[] | null = null
    let dedupedTotal = 0
    let threadError: any = null

    if (groupId) {
      const allGroupThreadsRes = await serviceClient
        .from('chat_threads')
        .select(THREAD_SELECT)
        .eq('group_id', groupId)
        .eq('type', 'group')
        .in('id', threadIds)
        .order('last_message_at', { ascending: false, nullsFirst: false })

      threadError = allGroupThreadsRes.error
      if (!threadError) {
        const allGroupThreads = allGroupThreadsRes.data || []
        const deduped = deduplicateThreadsByParticipants(allGroupThreads)
        dedupedTotal = deduped.length
        threads = deduped.slice(from, to + 1)
      }
    } else {
      const threadsRes = await serviceClient
        .from('chat_threads')
        .select(THREAD_SELECT)
        .in('id', threadIds)
        .order('last_message_at', { ascending: false, nullsFirst: false })

      threadError = threadsRes.error
      if (!threadError) {
        const allThreads = threadsRes.data || []
        const deduped = deduplicateThreadsByParticipants(allThreads)
        dedupedTotal = deduped.length
        threads = deduped.slice(from, to + 1)
      }
    }

    if (threadError) return errorResponse(threadError.message, 400)
    if (!threads || threads.length === 0) {
      return jsonResponse({
        data: [],
        meta: { page, pageSize: limit, hasMore: false },
      })
    }

    const result = threads.map((t: any) => {
      const { group_banner, ...rest } = t
      const pref = myPrefsByThreadId.get(t.id)
      return {
        ...rest,
        banner_url: group_banner?.banner_url ?? null,
        unread_count: pref?.unread_count ?? 0,
        pinned: pref?.pinned ?? false,
        pinned_at: pref?.pinned_at ?? null,
        archived: pref?.archived ?? false,
      }
    })

    return jsonResponse({
      data: result,
      meta: {
        page,
        pageSize: limit,
        hasMore: dedupedTotal > to + 1,
      },
    })
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
    const rawGroupId = body.group_id
    const effectiveGroupId =
      typeof rawGroupId === 'string' && rawGroupId.trim().length > 0 ? rawGroupId.trim() : undefined

    if (!participantIds || !Array.isArray(participantIds)) {
      return errorResponse('participant_ids is required and must be an array', 400)
    }

    const allParticipantIds = [...new Set([user.id, ...participantIds])]
    const resolvedType = allParticipantIds.length > 2 ? 'group' : type

    if (resolvedType === 'group' && effectiveGroupId) {
      const { data: mem, error: memErr } = await serviceClient
        .from('group_memberships')
        .select('id')
        .eq('group_id', effectiveGroupId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (memErr) return errorResponse(memErr.message, 400)
      if (!mem) return errorResponse('Not a member of this group', 403)

      const { data: existingGroupThread } = await serviceClient
        .from('chat_threads')
        .select('id')
        .eq('group_id', effectiveGroupId)
        .eq('type', 'group')
        .maybeSingle()

      if (existingGroupThread?.id) {
        const { data: part } = await serviceClient
          .from('chat_participants')
          .select('id')
          .eq('thread_id', existingGroupThread.id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (!part) {
          const { error: addPartErr } = await serviceClient.from('chat_participants').insert({
            thread_id: existingGroupThread.id,
            user_id: user.id,
            role: 'member',
          })
          if (addPartErr) return errorResponse(addPartErr.message, 400)
        }
        return jsonResponse({ data: { id: existingGroupThread.id } }, 201)
      }
    }

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

    const insertRow: Record<string, unknown> = {
      type: resolvedType,
      title: title || null,
      name: name || title || null,
      created_by: user.id,
    }
    if (resolvedType === 'group' && effectiveGroupId) {
      insertRow.group_id = effectiveGroupId
    }

    const { data: thread, error: threadError } = await serviceClient
      .from('chat_threads')
      .insert(insertRow)
      .select()
      .single()

    if (threadError || !thread) {
      if (threadError?.code === '23505' && resolvedType === 'group' && effectiveGroupId) {
        const { data: existingGroupThread } = await serviceClient
          .from('chat_threads')
          .select('id')
          .eq('group_id', effectiveGroupId)
          .eq('type', 'group')
          .maybeSingle()

        if (existingGroupThread?.id) {
          const { data: part } = await serviceClient
            .from('chat_participants')
            .select('id')
            .eq('thread_id', existingGroupThread.id)
            .eq('user_id', user.id)
            .maybeSingle()

          if (!part) {
            const { error: addPartErr } = await serviceClient.from('chat_participants').insert({
              thread_id: existingGroupThread.id,
              user_id: user.id,
              role: 'member',
            })
            if (addPartErr) return errorResponse(addPartErr.message, 400)
          }
          return jsonResponse({ data: { id: existingGroupThread.id } }, 201)
        }
      }
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
