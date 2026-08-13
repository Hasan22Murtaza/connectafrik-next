import type { SupabaseClient } from '@supabase/supabase-js'
import { filterThreadIdsAccessibleToUser } from '@/lib/chat/chatThreadAccess'
import { CALL_NOTIFICATION_TYPES } from '@/shared/types/notifications'

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

function laterIso(a?: string | null, b?: string | null): string | undefined {
  const aTime = a ? new Date(a).getTime() : NaN
  const bTime = b ? new Date(b).getTime() : NaN
  const aValid = Number.isFinite(aTime)
  const bValid = Number.isFinite(bTime)
  if (aValid && bValid) return aTime >= bTime ? a! : b!
  if (aValid) return a!
  if (bValid) return b!
  return undefined
}

export async function getCallsLastViewedAt(
  serviceClient: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await serviceClient
    .from('profiles')
    .select('calls_last_viewed_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('calls_last_viewed_at lookup failed:', error.message)
    return null
  }
  const value = (data as { calls_last_viewed_at?: string | null } | null)?.calls_last_viewed_at
  return typeof value === 'string' && value.trim() ? value : null
}

/** Prefer the later of a client `since` hint and the persisted profile timestamp. */
export function resolveCallsViewedSince(
  clientSince?: string | null,
  profileSince?: string | null
): string | undefined {
  return laterIso(clientSince, profileSince)
}

/**
 * Clear call notifications for the user: mark unread call rows as read and
 * stamp `profiles.calls_last_viewed_at` so the header badge stays cleared.
 */
export async function markAllCallNotificationsRead(
  serviceClient: SupabaseClient,
  userId: string
): Promise<{ viewed_at: string }> {
  const viewedAt = new Date().toISOString()

  const { error: notificationError } = await serviceClient
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .in('type', [...CALL_NOTIFICATION_TYPES])

  if (notificationError) throw notificationError

  const { error: profileError } = await serviceClient
    .from('profiles')
    .update({ calls_last_viewed_at: viewedAt })
    .eq('id', userId)

  if (profileError) {
    console.error('Failed to stamp calls_last_viewed_at:', profileError.message)
  }

  return { viewed_at: viewedAt }
}
