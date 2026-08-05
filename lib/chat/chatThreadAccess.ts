import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Chat access requires a `chat_participants` row. For threads tied to a group (`chat_threads.group_id`),
 * the user must also have an active `group_memberships` row (covers leave group while participant row is stale).
 */
export async function requireChatThreadAccess(
  serviceClient: SupabaseClient,
  userId: string,
  threadId: string
): Promise<boolean> {
  const { data: participant } = await serviceClient
    .from('chat_participants')
    .select('id')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!participant) return false

  const { data: thread } = await serviceClient
    .from('chat_threads')
    .select('group_id')
    .eq('id', threadId)
    .maybeSingle()

  const groupId = thread?.group_id ?? null
  if (!groupId) return true

  const { data: membership } = await serviceClient
    .from('group_memberships')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  return Boolean(membership)
}

/**
 * Drops thread ids the user may still have in `chat_participants` but no longer has active group membership for.
 * Direct threads (no `group_id`) are kept.
 */
export async function filterThreadIdsAccessibleToUser(
  serviceClient: SupabaseClient,
  userId: string,
  threadIds: string[]
): Promise<string[]> {
  const unique = [...new Set(threadIds)].filter(Boolean)
  if (unique.length === 0) return []

  const { data: threads, error } = await serviceClient
    .from('chat_threads')
    .select('id, group_id')
    .in('id', unique)

  if (error || !threads?.length) return []

  const groupIds = [
    ...new Set(
      (threads as { group_id: string | null }[])
        .map((t) => t.group_id)
        .filter((g): g is string => Boolean(g))
    ),
  ]

  let activeGroupIds = new Set<string>()
  if (groupIds.length > 0) {
    const { data: mems } = await serviceClient
      .from('group_memberships')
      .select('group_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .in('group_id', groupIds)

    activeGroupIds = new Set((mems || []).map((m: { group_id: string }) => m.group_id))
  }

  const threadById = new Map(
    (threads as { id: string; group_id: string | null }[]).map((t) => [t.id, t])
  )

  return unique.filter((tid) => {
    const t = threadById.get(tid)
    if (!t) return false
    if (!t.group_id) return true
    return activeGroupIds.has(t.group_id)
  })
}
