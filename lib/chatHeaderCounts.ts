import type { SupabaseClient } from '@supabase/supabase-js'
import { filterThreadIdsAccessibleToUser } from '@/lib/chatThreadAccess'

/** Sum of unread messages across active, non-blocked chat threads for the user. */
export async function getTotalUnreadMessageCount(
  serviceClient: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: rows, error } = await serviceClient
    .from('chat_participants')
    .select('thread_id, unread_count')
    .eq('user_id', userId)
    .gt('unread_count', 0)
    .eq('archived', false)
    .eq('is_block', false)
    .is('deleted_at', null)

  if (error) throw error
  if (!rows?.length) return 0

  const threadIds = rows.map((r) => r.thread_id as string)
  const accessible = await filterThreadIdsAccessibleToUser(serviceClient, userId, threadIds)
  const accessibleSet = new Set(accessible)

  return rows
    .filter((r) => accessibleSet.has(r.thread_id as string))
    .reduce((sum, r) => sum + (typeof r.unread_count === 'number' ? r.unread_count : 0), 0)
}

/** Incoming missed/declined calls the user did not initiate (optionally after `since`). */
export async function getMissedCallCount(
  serviceClient: SupabaseClient,
  userId: string,
  since?: string | null
): Promise<number> {
  const { data: participantRows } = await serviceClient
    .from('chat_participants')
    .select('thread_id')
    .eq('user_id', userId)
    .is('deleted_at', null)

  const rawThreadIds = (participantRows ?? []).map((p: { thread_id: string }) => p.thread_id)
  const threadIds = await filterThreadIdsAccessibleToUser(serviceClient, userId, rawThreadIds)
  if (!threadIds.length) return 0

  let query = serviceClient
    .from('call_sessions')
    .select('id', { count: 'exact', head: true })
    .in('thread_id', threadIds)
    .in('status', ['missed', 'declined'])
    .neq('created_by', userId)

  if (since) {
    query = query.gt('updated_at', since)
  }

  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}
