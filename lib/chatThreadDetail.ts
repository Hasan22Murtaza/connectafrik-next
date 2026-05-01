import { createServiceClient } from '@/lib/supabase-server'

export const CHAT_THREAD_DETAIL_SELECT = `
  id,
  type,
  title,
  name,
  banner_url,
  group_id,
  group_banner:groups!chat_threads_group_id_fkey(banner_url),
  last_message_preview,
  last_message_at,
  last_activity_at,
  created_at,
  updated_at,
  chat_participants(
    user:profiles!user_id(id, username, full_name, avatar_url, status, last_seen)
  )
`

/** Current user's row in `chat_participants` for a thread. */
export type ThreadParticipantPrefs = {
  unread_count: number
  pinned: boolean
  pinned_at: string | null
  archived: boolean
}

export async function getMyThreadParticipantPrefs(
  serviceClient: ReturnType<typeof createServiceClient>,
  userId: string,
  threadId: string
): Promise<ThreadParticipantPrefs> {
  const { data: row } = await serviceClient
    .from('chat_participants')
    .select('unread_count, pinned, pinned_at, archived')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .maybeSingle()
  return {
    unread_count: typeof row?.unread_count === 'number' ? row.unread_count : 0,
    pinned: Boolean(row?.pinned),
    pinned_at: typeof row?.pinned_at === 'string' ? row.pinned_at : null,
    archived: Boolean(row?.archived),
  }
}

export async function getMyThreadUnreadCount(
  serviceClient: ReturnType<typeof createServiceClient>,
  userId: string,
  threadId: string
): Promise<number> {
  const prefs = await getMyThreadParticipantPrefs(serviceClient, userId, threadId)
  return prefs.unread_count
}

export function threadToResponseBody(thread: Record<string, unknown>, prefs: ThreadParticipantPrefs) {
  const {
    group_banner,
    banner_url: threadBanner,
    archived: _omitArchivedFromThread,
    ...threadRest
  } = thread as {
    group_banner?: { banner_url?: string | null } | null
    banner_url?: string | null
    archived?: unknown
  }
  return {
    data: {
      ...threadRest,
      banner_url: threadBanner ?? group_banner?.banner_url ?? null,
      unread_count: prefs.unread_count,
      pinned: prefs.pinned,
      pinned_at: prefs.pinned_at,
      archived: prefs.archived,
    },
    meta: {
      page: 0,
      pageSize: 1,
      hasMore: false,
    },
  }
}
