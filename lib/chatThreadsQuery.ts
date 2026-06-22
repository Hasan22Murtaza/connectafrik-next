import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { filterThreadIdsAccessibleToUser } from '@/lib/chatThreadAccess'
import { getBlockStatesForThreads } from '@/lib/chatThreadBlock'

export type ThreadCategory = 'general' | 'marketplace'
export type ThreadListFilter = 'all' | 'unread' | 'groups'

export interface ThreadQueryOptions {
  /** Restrict results by conversation category. Ignored when `filter` is `groups`. */
  category?: ThreadCategory
  /** Limit to a single group's thread. */
  groupId?: string
  /** Additional list filter: only unread, or only group threads. */
  filter?: ThreadListFilter
  /** Force a page size (otherwise read from the request query). */
  limit?: number
  /** Force a page index (otherwise read from the request query). */
  page?: number
}

export interface ThreadQueryResult {
  data: any[]
  meta: { page: number; pageSize: number; hasMore: boolean }
}

type ThreadPrefs = {
  unread_count: number
  pinned: boolean
  pinned_at: string | null
  archived: boolean
  is_block: boolean
  blocked_by_other: boolean
}

const THREAD_SELECT = `
  id,
  type,
  title,
  name,
  group_id,
  product_id,
  seller_id,
  product:products!chat_threads_product_id_fkey(id, title, images),
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
      group_id: row.group_id ?? null,
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
): Promise<Map<string, ThreadPrefs>> {
  if (threadIds.length === 0) return new Map()
  const [{ data }, blockStates] = await Promise.all([
    serviceClient
      .from('chat_participants')
      .select('thread_id, unread_count, pinned, pinned_at, archived, is_block')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .in('thread_id', threadIds),
    getBlockStatesForThreads(serviceClient, userId, threadIds),
  ])
  const m = new Map<string, ThreadPrefs>()
  for (const row of data ?? []) {
    const tid = row.thread_id as string
    const block = blockStates.get(tid)
    m.set(tid, {
      unread_count: typeof row.unread_count === 'number' ? row.unread_count : 0,
      pinned: Boolean(row.pinned),
      pinned_at: typeof row.pinned_at === 'string' ? row.pinned_at : null,
      archived: Boolean(row.archived),
      is_block: block?.blockedByMe ?? Boolean(row.is_block),
      blocked_by_other: block?.blockedByOther ?? false,
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

const isGroupRow = (thread: { type?: string; group_id?: string | null }) =>
  thread?.type === 'group' || Boolean(thread?.group_id)

/**
 * Shared loader for the authenticated user's chat thread list.
 *
 * Handles category scoping (`general` / `marketplace`), single-group scoping,
 * and the `filter` predicate used by the WhatsApp-style sidebar chips
 * (`unread`, `groups`). Includes the RLS recursion fallback via the
 * `get_user_threads` RPC so every thread endpoint behaves consistently.
 *
 * Throws on auth failure (caller should map to 401) and on query errors.
 */
export async function queryUserThreads(
  request: NextRequest,
  options: ThreadQueryOptions = {}
): Promise<ThreadQueryResult> {
  const { user, supabase } = await getAuthenticatedUser(request)
  const { searchParams } = new URL(request.url)

  const parsedLimit = parseInt(searchParams.get('limit') || '50', 10)
  const parsedPage = parseInt(searchParams.get('page') || '0', 10)
  const limit =
    typeof options.limit === 'number'
      ? Math.min(Math.max(options.limit, 1), 100)
      : Number.isNaN(parsedLimit)
        ? 50
        : Math.min(Math.max(parsedLimit, 1), 100)
  const page =
    typeof options.page === 'number'
      ? Math.max(options.page, 0)
      : Number.isNaN(parsedPage)
        ? 0
        : Math.max(parsedPage, 0)
  const from = page * limit
  const to = from + limit - 1

  const rawCategoryParam = searchParams.get('category') || undefined
  const categoryFromQuery: ThreadCategory | undefined =
    rawCategoryParam === 'general' || rawCategoryParam === 'marketplace' ? rawCategoryParam : undefined
  const rawFilterParam = searchParams.get('filter') || undefined
  const filterFromQuery: ThreadListFilter | undefined =
    rawFilterParam === 'unread' || rawFilterParam === 'groups' || rawFilterParam === 'all'
      ? rawFilterParam
      : undefined

  const groupId = options.groupId ?? searchParams.get('group_id') ?? undefined
  const filter: ThreadListFilter = options.filter ?? filterFromQuery ?? 'all'
  // A `groups` filter is inherently general (group threads are never marketplace).
  const category: ThreadCategory | undefined =
    filter === 'groups' ? undefined : options.category ?? categoryFromQuery

  const emptyResult = (): ThreadQueryResult => ({
    data: [],
    meta: { page, pageSize: limit, hasMore: false },
  })

  const serviceClient = createServiceClient()

  const { data: participantRows, error: partError } = await serviceClient
    .from('chat_participants')
    .select('thread_id, unread_count, pinned, pinned_at, archived, is_block')
    .eq('user_id', user.id)
    .is('deleted_at', null)

  if (partError) {
    const isRecursion =
      partError.code === '42P17' ||
      (typeof partError.message === 'string' && partError.message.toLowerCase().includes('infinite recursion'))
    if (!isRecursion) {
      throw new Error(partError.message)
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_threads', { user_uuid: user.id })
    if (rpcError) throw new Error(rpcError.message)
    const rows = Array.isArray(rpcData) ? rpcData : []
    const normalized = mapRpcRowsToThreadShape(rows)
    const categorized =
      filter === 'groups'
        ? normalized.filter((t: { type?: string; group_id?: string | null }) => isGroupRow(t))
        : category === 'marketplace'
          ? normalized.filter((t: { type?: string }) => t.type === 'marketplace')
          : category === 'general'
            ? normalized.filter((t: { type?: string }) => t.type !== 'marketplace')
            : normalized
    const deduped = deduplicateThreadsByParticipants(categorized)
    const rpcPrefs = await getParticipantPrefsForThreads(
      serviceClient,
      user.id,
      deduped.map((t: { id?: string }) => t.id).filter((id): id is string => typeof id === 'string')
    )
    let visibleDeduped = deduped.filter((t: { id?: string }) => {
      const id = typeof t?.id === 'string' ? t.id : ''
      return Boolean(id && rpcPrefs.has(id))
    })
    for (const t of visibleDeduped) {
      const id = typeof t?.id === 'string' ? t.id : ''
      const pref = id ? rpcPrefs.get(id) : undefined
      t.unread_count = pref?.unread_count ?? 0
      t.pinned = pref?.pinned ?? false
      t.pinned_at = pref?.pinned_at ?? null
      t.archived = pref?.archived ?? false
      t.is_block = pref?.is_block ?? false
      t.blocked_by_other = pref?.blocked_by_other ?? false
    }
    if (filter === 'unread') {
      visibleDeduped = visibleDeduped.filter(
        (t: { unread_count?: number; archived?: boolean; is_block?: boolean }) =>
          (t.unread_count ?? 0) > 0 && !t.archived && !t.is_block
      )
    }
    return {
      data: visibleDeduped.slice(from, to + 1),
      meta: { page, pageSize: limit, hasMore: visibleDeduped.length > to + 1 },
    }
  }

  if (!participantRows || participantRows.length === 0) {
    return emptyResult()
  }

  const rawThreadIds = [...new Set(participantRows.map((p: { thread_id: string }) => p.thread_id))]
  const blockStates = await getBlockStatesForThreads(serviceClient, user.id, rawThreadIds)

  const myPrefsByThreadId = new Map<string, ThreadPrefs>(
    participantRows.map(
      (p: {
        thread_id: string
        unread_count?: number | null
        pinned?: boolean | null
        pinned_at?: string | null
        archived?: boolean | null
        is_block?: boolean | null
      }) => {
        const block = blockStates.get(p.thread_id)
        return [
          p.thread_id,
          {
            unread_count: typeof p.unread_count === 'number' ? p.unread_count : 0,
            pinned: Boolean(p.pinned),
            pinned_at: typeof p.pinned_at === 'string' ? p.pinned_at : null,
            archived: Boolean(p.archived),
            is_block: block?.blockedByMe ?? Boolean(p.is_block),
            blocked_by_other: block?.blockedByOther ?? false,
          },
        ] as [string, ThreadPrefs]
      }
    )
  )

  // For the `unread` filter, narrow to threads this user has not read and that
  // are still active (not archived / blocked) before touching chat_threads.
  const workingThreadIds =
    filter === 'unread'
      ? rawThreadIds.filter((id) => {
          const pref = myPrefsByThreadId.get(id)
          return Boolean(pref && pref.unread_count > 0 && !pref.archived && !pref.is_block)
        })
      : rawThreadIds

  if (workingThreadIds.length === 0) {
    return emptyResult()
  }

  const threadIds = await filterThreadIdsAccessibleToUser(serviceClient, user.id, workingThreadIds)
  if (threadIds.length === 0) {
    return emptyResult()
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
      const deduped = deduplicateThreadsByParticipants(allGroupThreadsRes.data || [])
      dedupedTotal = deduped.length
      threads = deduped.slice(from, to + 1)
    }
  } else {
    let threadsQuery = serviceClient.from('chat_threads').select(THREAD_SELECT).in('id', threadIds)

    if (filter === 'groups') {
      threadsQuery = threadsQuery.eq('type', 'group')
    } else if (category === 'marketplace') {
      threadsQuery = threadsQuery.eq('type', 'marketplace')
    } else if (category === 'general') {
      threadsQuery = threadsQuery.neq('type', 'marketplace')
    }

    const threadsRes = await threadsQuery.order('last_message_at', {
      ascending: false,
      nullsFirst: false,
    })

    threadError = threadsRes.error
    if (!threadError) {
      const deduped = deduplicateThreadsByParticipants(threadsRes.data || [])
      dedupedTotal = deduped.length
      threads = deduped.slice(from, to + 1)
    }
  }

  if (threadError) throw new Error(threadError.message)
  if (!threads || threads.length === 0) {
    return emptyResult()
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
      is_block: pref?.is_block ?? false,
      blocked_by_other: pref?.blocked_by_other ?? false,
    }
  })

  return {
    data: result,
    meta: { page, pageSize: limit, hasMore: dedupedTotal > to + 1 },
  }
}
