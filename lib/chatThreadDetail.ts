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
  archived,
  created_at,
  updated_at,
  chat_participants(
    user:profiles!user_id(id, username, full_name, avatar_url, status, last_seen)
  )
`

export async function getMyThreadUnreadCount(
  serviceClient: ReturnType<typeof createServiceClient>,
  userId: string,
  threadId: string
): Promise<number> {
  const { data: row } = await serviceClient
    .from('chat_participants')
    .select('unread_count')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .maybeSingle()
  return typeof row?.unread_count === 'number' ? row.unread_count : 0
}

export function threadToResponseBody(thread: Record<string, unknown>, unread_count: number) {
  const { group_banner, banner_url: threadBanner, ...threadRest } = thread as {
    group_banner?: { banner_url?: string | null } | null
    banner_url?: string | null
  }
  return {
    data: {
      ...threadRest,
      banner_url: threadBanner ?? group_banner?.banner_url ?? null,
      unread_count,
    },
    meta: {
      page: 0,
      pageSize: 1,
      hasMore: false,
    },
  }
}
