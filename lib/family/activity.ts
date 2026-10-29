import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActivityEventType, ActivitySummary } from '@/shared/types/family'
import { getActiveMembership, isManagedRole } from './auth'

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export async function recordActivityEvent(
  supabase: SupabaseClient,
  userId: string,
  eventType: ActivityEventType,
  quantity = 1,
  metadata?: Record<string, unknown>
): Promise<void> {
  const membership = await getActiveMembership(supabase, userId)
  if (!membership || !isManagedRole(membership.role)) {
    return
  }

  const { error } = await supabase.from('activity_events').insert({
    family_member_id: membership.id,
    user_id: userId,
    event_type: eventType,
    quantity: Math.max(1, Math.floor(quantity)),
    metadata: metadata ?? null,
  })

  if (error) {
    console.error('Failed to record activity event:', error.message)
  }
}

/** Sums today's session_ping events (1 ping ≈ 1 minute). */
export async function sumSessionMinutesToday(
  supabase: SupabaseClient,
  familyMemberId: string,
  now: Date = new Date()
): Promise<number> {
  const start = startOfUtcDay(now).toISOString()
  const { data, error } = await supabase
    .from('activity_events')
    .select('quantity')
    .eq('family_member_id', familyMemberId)
    .eq('event_type', 'session_ping')
    .gte('occurred_at', start)

  if (error) {
    console.error('Failed to sum session minutes:', error.message)
    return 0
  }

  return (data || []).reduce((sum, row) => sum + (row.quantity || 0), 0)
}

export async function buildActivitySummary(
  supabase: SupabaseClient,
  familyMemberId: string,
  periodStart: Date,
  periodEnd: Date = new Date()
): Promise<ActivitySummary> {
  const { data, error } = await supabase
    .from('activity_events')
    .select('event_type, quantity')
    .eq('family_member_id', familyMemberId)
    .gte('occurred_at', periodStart.toISOString())
    .lte('occurred_at', periodEnd.toISOString())

  if (error) throw new Error(error.message)

  const totals: Record<string, number> = {}
  for (const row of data || []) {
    totals[row.event_type] = (totals[row.event_type] || 0) + (row.quantity || 0)
  }

  return {
    family_member_id: familyMemberId,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    session_minutes: totals.session_ping || 0,
    posts_viewed: totals.post_view || 0,
    reels_watched: totals.reel_view || 0,
    messages_sent: totals.message_sent || 0,
    calls: totals.call || 0,
    friends_added: totals.friend_added || 0,
    friend_requests:
      (totals.friend_request_sent || 0) + (totals.friend_request_received || 0),
    groups_joined: totals.group_joined || 0,
    reports: totals.report || 0,
    safety_alerts: totals.safety_alert || 0,
  }
}

export function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}
