import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { filterThreadIdsAccessibleToUser } from '@/lib/chat/chatThreadAccess'

/**
 * Reconciliation catch-up for missed realtime INSERTs.
 *
 * Supabase's `postgres_changes` stream has no replay: a client whose socket is
 * asleep, backgrounded, or mid-reconnect when a call session is INSERTed
 * simply never sees that event, with nothing to catch it up later. This is
 * the actual mechanism behind "group call doesn't ring on every device" -- it
 * is not only the `active` status gate on the dispatch check, it is that
 * without this endpoint there was no code path querying current state at all
 * after a missed event. Call this once on mount and on visibility/online
 * restore; the window is kept tight (`RECENT_WINDOW_MS`) so it only ever
 * surfaces calls that are still plausibly ringing.
 */
const RECENT_WINDOW_MS = 90_000
const JOINABLE_STATUSES = ['ringing', 'initiated', 'active']

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const { data: participantRows } = await serviceClient
      .from('chat_participants')
      .select('thread_id')
      .eq('user_id', user.id)

    const rawThreadIds = (participantRows || []).map((p: { thread_id: string }) => p.thread_id)
    const threadIds = await filterThreadIdsAccessibleToUser(serviceClient, user.id, rawThreadIds)
    if (threadIds.length === 0) {
      return jsonResponse({ sessions: [] })
    }

    const since = new Date(Date.now() - RECENT_WINDOW_MS).toISOString()

    const { data: rows, error } = await serviceClient
      .from('call_sessions')
      .select('*')
      .in('thread_id', threadIds)
      .in('status', JOINABLE_STATUSES)
      .gte('started_at', since)
      .neq('created_by', user.id)
      .order('started_at', { ascending: false })
      .limit(20)

    if (error) return errorResponse(error.message, 400)

    const sessions = (rows || []).filter((row: Record<string, unknown>) => {
      const meta =
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {}
      const isGroup = meta.isGroupCall === true
      const status = String(row.status)

      // Same joinability rule as the client dispatch gate: a 1:1 call that is
      // already `active` has been answered by its only callee.
      if (!isGroup && status === 'active') return false

      const participants = Array.isArray(row.participants) ? (row.participants as string[]) : []
      if (participants.includes(user.id)) return false

      const declined = Array.isArray(meta.declinedUserIds) ? (meta.declinedUserIds as string[]) : []
      if (declined.includes(user.id)) return false

      if (meta.targetUserId && meta.targetUserId !== user.id) return false

      return true
    })

    return jsonResponse({ sessions })
  } catch (e: any) {
    if (e.message === 'Unauthorized' || e.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(e.message || 'Failed to load incoming call sessions', 500)
  }
}
