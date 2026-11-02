import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminUserStats } from '@/lib/marketplace/adminUserService'
import { getReportStats } from '@/lib/reports/reportService'
import { isLiveKitConfigured } from '@/lib/call-media/livekit'
import type { PostReportReason, PostReportStatus } from '@/lib/reports/types'
import { POST_REPORT_REASON_LABELS } from '@/lib/reports/types'

export type MonitoringRange = '24h' | '7d' | '30d' | '90d'

export type MonitoringEventStatus =
  | 'success'
  | 'pending'
  | 'warning'
  | 'failed'
  | 'blocked'
  | 'info'

export type MonitoringEventSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'

export type MonitoringEventType =
  | 'user_registered'
  | 'post_created'
  | 'reel_created'
  | 'listing_created'
  | 'post_reported'
  | 'report_action'
  | 'call_started'
  | 'call_ended'
  | 'call_failed'
  | 'call_missed'
  | 'feedback_submitted'

export interface MonitoringKpis {
  active_users: number
  online_users: number
  new_users: number
  posts_in_period: number
  pending_reports: number
  under_review_reports: number
  resolved_reports: number
  dismissed_reports: number
  high_priority_reports: number
  active_calls: number
  calls_in_period: number
  audio_calls: number
  video_calls: number
  failed_calls: number
  missed_calls: number
  average_call_duration_seconds: number
  comments_in_period: number
  reactions_in_period: number
  messages_in_period: number
  reels_in_period: number
  listings_in_period: number
  removed_posts: number
  open_feedback: number
}

export interface MonitoringActivityChart {
  users: number
  posts: number
  comments: number
  reactions: number
  messages: number
  calls: number
  reels: number
  listings: number
}

export interface MonitoringActivityEvent {
  id: string
  event_type: MonitoringEventType
  title: string
  actor_id: string | null
  actor_name: string | null
  actor_username: string | null
  target_id: string | null
  target_label: string | null
  status: MonitoringEventStatus
  severity: MonitoringEventSeverity
  timestamp: string
  href: string | null
  metadata: Record<string, unknown>
}

export interface MonitoringCallRow {
  id: string
  call_id: string | null
  initiator_id: string | null
  initiator_name: string | null
  initiator_username: string | null
  participant_count: number
  call_type: 'audio' | 'video' | 'unknown'
  provider: string | null
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  status: string
}

export interface MonitoringContentRow {
  id: string
  content_type: 'post' | 'reel' | 'listing'
  preview: string
  creator_id: string | null
  creator_name: string | null
  creator_username: string | null
  reports: number
  status: string
  created_at: string
  href: string | null
}

export interface MonitoringAdminAction {
  id: string
  admin_id: string | null
  admin_name: string | null
  admin_username: string | null
  action: string
  target_id: string
  target_label: string | null
  notes: string | null
  timestamp: string
  href: string | null
}

export interface MonitoringServiceHealth {
  id: string
  label: string
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  response_ms: number | null
  detail: string
  last_checked: string
}

export interface MonitoringSnapshot {
  range: MonitoringRange
  generated_at: string
  kpis: MonitoringKpis
  activity_chart: MonitoringActivityChart
  report_reasons: Record<string, number>
  call_status_breakdown: Record<string, number>
  activity_events: MonitoringActivityEvent[]
  recent_content: MonitoringContentRow[]
  recent_calls: MonitoringCallRow[]
  admin_actions: MonitoringAdminAction[]
  services: MonitoringServiceHealth[]
}

const ONLINE_WINDOW_MS = 15 * 60 * 1000
const HIGH_PRIORITY_REASONS: PostReportReason[] = ['child_abuse', 'harmful_or_dangerous']
const ACTIVE_CALL_STATUSES = ['initiated', 'ringing', 'active'] as const

const RANGE_MS: Record<MonitoringRange, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
}

function rangeStart(range: MonitoringRange): string {
  return new Date(Date.now() - RANGE_MS[range]).toISOString()
}

function onlineSince(): string {
  return new Date(Date.now() - ONLINE_WINDOW_MS).toISOString()
}

async function countRows(
  client: SupabaseClient,
  table: string,
  apply?: (q: any) => any
): Promise<number> {
  let query = client.from(table).select('id', { count: 'exact', head: true })
  if (apply) query = apply(query)
  const { count, error } = await query
  if (error) {
    // Table/column may not exist in every environment — treat as zero.
    console.warn(`[monitoring] count failed for ${table}:`, error.message)
    return 0
  }
  return count ?? 0
}

function profileName(row: {
  full_name?: string | null
  username?: string | null
} | null): string | null {
  if (!row) return null
  return row.full_name?.trim() || row.username?.trim() || null
}

function truncate(text: string | null | undefined, max = 72): string {
  const value = (text || '').trim()
  if (!value) return '—'
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value
}

function callTypeOf(row: Record<string, unknown>): 'audio' | 'video' | 'unknown' {
  const raw = row.call_type
  if (raw === 'video' || raw === 'audio') return raw
  const meta = row.metadata
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const t = (meta as Record<string, unknown>).callType
    if (t === 'video' || t === 'audio') return t
  }
  return 'unknown'
}

function providerOf(row: Record<string, unknown>): string | null {
  const meta = row.metadata
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const p = (meta as Record<string, unknown>).provider
    if (typeof p === 'string' && p.trim()) return p.trim()
  }
  if (typeof row.provider === 'string' && row.provider.trim()) return row.provider.trim()
  return null
}

function participantCount(row: Record<string, unknown>): number {
  const parts = row.participants
  if (Array.isArray(parts)) return parts.length
  return 0
}

async function loadProfileMap(
  client: SupabaseClient,
  ids: string[]
): Promise<Map<string, { id: string; username: string | null; full_name: string | null; avatar_url: string | null }>> {
  const unique = [...new Set(ids.filter(Boolean))]
  const map = new Map<
    string,
    { id: string; username: string | null; full_name: string | null; avatar_url: string | null }
  >()
  if (unique.length === 0) return map

  const { data, error } = await client
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', unique.slice(0, 200))

  if (error) {
    console.warn('[monitoring] profile map failed:', error.message)
    return map
  }

  for (const row of data || []) {
    map.set(row.id, row)
  }
  return map
}

async function getHighPriorityReportCount(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from('post_reports')
    .select('id', { count: 'exact', head: true })
    .in('reason', HIGH_PRIORITY_REASONS)
    .in('status', ['pending', 'under_review'])

  if (error) {
    console.warn('[monitoring] high-priority reports failed:', error.message)
    return 0
  }
  return count ?? 0
}

async function getCallStats(
  client: SupabaseClient,
  since: string
): Promise<{
  active: number
  total: number
  audio: number
  video: number
  failed: number
  missed: number
  avgDuration: number
  breakdown: Record<string, number>
  recent: Record<string, unknown>[]
}> {
  const [active, total, failed, missed, video, audio, recentResult, durationResult] =
    await Promise.all([
      countRows(client, 'call_sessions', (q) => q.in('status', [...ACTIVE_CALL_STATUSES])),
      countRows(client, 'call_sessions', (q) => q.gte('created_at', since)),
      countRows(client, 'call_sessions', (q) =>
        q.gte('created_at', since).eq('status', 'failed')
      ),
      countRows(client, 'call_sessions', (q) =>
        q.gte('created_at', since).eq('status', 'missed')
      ),
      countRows(client, 'call_sessions', (q) =>
        q.gte('created_at', since).eq('call_type', 'video')
      ),
      countRows(client, 'call_sessions', (q) =>
        q.gte('created_at', since).eq('call_type', 'audio')
      ),
      client
        .from('call_sessions')
        .select(
          'id, call_id, created_by, participants, call_type, status, started_at, ended_at, created_at, duration_seconds, metadata, room_id'
        )
        .order('created_at', { ascending: false })
        .limit(12),
      client
        .from('call_sessions')
        .select('duration_seconds, status')
        .gte('created_at', since)
        .not('duration_seconds', 'is', null)
        .limit(500),
    ])

  const breakdown: Record<string, number> = {}
  const durationRows = durationResult.data || []
  let durationSum = 0
  let durationCount = 0
  for (const row of durationRows) {
    const seconds = Number(row.duration_seconds)
    if (Number.isFinite(seconds) && seconds >= 0) {
      durationSum += seconds
      durationCount += 1
    }
  }

  // Build status breakdown from recent page + period counts we already have.
  breakdown.active = active
  breakdown.failed = failed
  breakdown.missed = missed
  breakdown.ended = Math.max(0, total - active - failed - missed)

  if (durationResult.error) {
    console.warn('[monitoring] call duration sample failed:', durationResult.error.message)
  }
  if (recentResult.error) {
    console.warn('[monitoring] recent calls failed:', recentResult.error.message)
  }

  return {
    active,
    total,
    audio,
    video,
    failed,
    missed,
    avgDuration: durationCount > 0 ? Math.round(durationSum / durationCount) : 0,
    breakdown,
    recent: (recentResult.data || []) as Record<string, unknown>[],
  }
}

async function getReportReasonBreakdown(
  client: SupabaseClient,
  since: string
): Promise<Record<string, number>> {
  const { data, error } = await client
    .from('post_reports')
    .select('reason')
    .gte('created_at', since)
    .limit(2000)

  if (error) {
    console.warn('[monitoring] report reasons failed:', error.message)
    return {}
  }

  const counts: Record<string, number> = {}
  for (const row of data || []) {
    const reason = String(row.reason || 'other')
    const label =
      POST_REPORT_REASON_LABELS[reason as PostReportReason] || reason.replace(/_/g, ' ')
    counts[label] = (counts[label] || 0) + 1
  }
  return counts
}

async function checkServices(client: SupabaseClient): Promise<MonitoringServiceHealth[]> {
  const now = new Date().toISOString()
  const services: MonitoringServiceHealth[] = []

  const dbStart = Date.now()
  const { error: dbError } = await client.from('profiles').select('id').limit(1)
  const dbMs = Date.now() - dbStart
  services.push({
    id: 'database',
    label: 'Database',
    status: dbError ? 'down' : dbMs > 1500 ? 'degraded' : 'healthy',
    response_ms: dbMs,
    detail: dbError ? dbError.message : 'Supabase query succeeded',
    last_checked: now,
  })

  services.push({
    id: 'supabase',
    label: 'Supabase / Auth',
    status: dbError ? 'down' : 'healthy',
    response_ms: dbMs,
    detail: dbError
      ? 'Unable to reach Supabase with the service role client'
      : 'Service-role client can query profiles',
    last_checked: now,
  })

  const livekitConfigured = isLiveKitConfigured()
  services.push({
    id: 'livekit',
    label: 'LiveKit',
    status: livekitConfigured ? 'healthy' : 'unknown',
    response_ms: null,
    detail: livekitConfigured
      ? 'LiveKit credentials are configured'
      : 'LiveKit credentials are not configured in this environment',
    last_checked: now,
  })

  return services
}

function eventSeverity(
  type: MonitoringEventType,
  status: MonitoringEventStatus
): MonitoringEventSeverity {
  if (type === 'post_reported' && status === 'pending') return 'high'
  if (type === 'call_failed') return 'high'
  if (type === 'call_missed') return 'medium'
  if (status === 'failed' || status === 'blocked') return 'high'
  if (status === 'warning' || status === 'pending') return 'medium'
  return 'info'
}

export async function getMonitoringSnapshot(
  client: SupabaseClient,
  options: {
    range?: MonitoringRange
    search?: string
    eventType?: string
    status?: string
    severity?: string
  } = {}
): Promise<MonitoringSnapshot> {
  const range: MonitoringRange = options.range && RANGE_MS[options.range] ? options.range : '7d'
  const since = rangeStart(range)
  const search = options.search?.trim().toLowerCase() || ''

  const [
    userStats,
    reportStats,
    highPriority,
    onlineUsers,
    usersInPeriod,
    postsInPeriod,
    commentsInPeriod,
    reactionsInPeriod,
    messagesInPeriod,
    reelsInPeriod,
    listingsInPeriod,
    removedPosts,
    openFeedbackNew,
    openFeedbackReview,
    callStats,
    reportReasons,
    services,
    recentProfiles,
    recentPosts,
    recentReels,
    recentListings,
    recentReports,
    recentActions,
  ] = await Promise.all([
    getAdminUserStats(client),
    getReportStats(client),
    getHighPriorityReportCount(client),
    countRows(client, 'profiles', (q) =>
      q.or(`last_active_at.gte.${onlineSince()},last_seen.gte.${onlineSince()}`)
    ),
    countRows(client, 'profiles', (q) => q.gte('created_at', since)),
    countRows(client, 'posts', (q) => q.gte('created_at', since).eq('is_deleted', false)),
    countRows(client, 'comments', (q) => q.gte('created_at', since)),
    countRows(client, 'post_reactions', (q) => q.gte('created_at', since)),
    countRows(client, 'chat_messages', (q) => q.gte('created_at', since).eq('is_deleted', false)),
    countRows(client, 'reels', (q) => q.gte('created_at', since).eq('is_deleted', false)),
    countRows(client, 'products', (q) => q.gte('created_at', since)),
    countRows(client, 'posts', (q) => q.gte('updated_at', since).eq('is_deleted', true)),
    countRows(client, 'feedback', (q) => q.eq('status', 'new')),
    countRows(client, 'feedback', (q) => q.eq('status', 'under_review')),
    getCallStats(client, since),
    getReportReasonBreakdown(client, since),
    checkServices(client),
    client
      .from('profiles')
      .select('id, username, full_name, avatar_url, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    client
      .from('posts')
      .select('id, content, author_id, created_at, is_deleted, media_type')
      .order('created_at', { ascending: false })
      .limit(10),
    client
      .from('reels')
      .select('id, title, description, author_id, created_at, is_deleted')
      .order('created_at', { ascending: false })
      .limit(8),
    client
      .from('products')
      .select('id, title, seller_id, created_at, is_available')
      .order('created_at', { ascending: false })
      .limit(8),
    client
      .from('post_report_groups')
      .select('*')
      .order('last_reported_at', { ascending: false })
      .limit(12),
    client
      .from('post_report_actions')
      .select('id, post_id, admin_id, action, notes, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  const profileIds = new Set<string>()
  for (const row of recentProfiles.data || []) profileIds.add(row.id)
  for (const row of recentPosts.data || []) if (row.author_id) profileIds.add(row.author_id)
  for (const row of recentReels.data || []) if (row.author_id) profileIds.add(row.author_id)
  for (const row of recentListings.data || []) if (row.seller_id) profileIds.add(row.seller_id)
  for (const row of recentReports.data || []) {
    if (row.author_id) profileIds.add(String(row.author_id))
  }
  for (const row of recentActions.data || []) {
    if (row.admin_id) profileIds.add(String(row.admin_id))
  }
  for (const row of callStats.recent) {
    if (typeof row.created_by === 'string') profileIds.add(row.created_by)
  }

  const profiles = await loadProfileMap(client, [...profileIds])

  const activity_events: MonitoringActivityEvent[] = []

  for (const row of recentProfiles.data || []) {
    activity_events.push({
      id: `user:${row.id}`,
      event_type: 'user_registered',
      title: 'User registered',
      actor_id: row.id,
      actor_name: profileName(row),
      actor_username: row.username,
      target_id: row.id,
      target_label: row.username || row.full_name,
      status: 'success',
      severity: 'info',
      timestamp: row.created_at,
      href: `/admin/users/${row.id}`,
      metadata: {},
    })
  }

  for (const row of recentPosts.data || []) {
    const author = profiles.get(row.author_id)
    activity_events.push({
      id: `post:${row.id}`,
      event_type: 'post_created',
      title: 'Post created',
      actor_id: row.author_id,
      actor_name: profileName(author || null),
      actor_username: author?.username || null,
      target_id: row.id,
      target_label: truncate(row.content),
      status: row.is_deleted ? 'blocked' : 'success',
      severity: 'info',
      timestamp: row.created_at,
      href: `/post/${row.id}`,
      metadata: { media_type: row.media_type, is_deleted: row.is_deleted },
    })
  }

  for (const row of recentReels.data || []) {
    const author = profiles.get(row.author_id)
    activity_events.push({
      id: `reel:${row.id}`,
      event_type: 'reel_created',
      title: 'Reel uploaded',
      actor_id: row.author_id,
      actor_name: profileName(author || null),
      actor_username: author?.username || null,
      target_id: row.id,
      target_label: truncate(row.title || row.description),
      status: row.is_deleted ? 'blocked' : 'success',
      severity: 'info',
      timestamp: row.created_at,
      href: `/reels?id=${row.id}`,
      metadata: { is_deleted: row.is_deleted },
    })
  }

  for (const row of recentListings.data || []) {
    const seller = profiles.get(row.seller_id)
    activity_events.push({
      id: `listing:${row.id}`,
      event_type: 'listing_created',
      title: 'Marketplace listing created',
      actor_id: row.seller_id,
      actor_name: profileName(seller || null),
      actor_username: seller?.username || null,
      target_id: row.id,
      target_label: truncate(row.title),
      status: row.is_available === false ? 'blocked' : 'success',
      severity: 'info',
      timestamp: row.created_at,
      href: `/marketplace/product/${row.id}`,
      metadata: { is_available: row.is_available },
    })
  }

  for (const row of recentReports.data || []) {
    const status = String(row.status || 'pending') as PostReportStatus
    const mappedStatus: MonitoringEventStatus =
      status === 'pending' || status === 'under_review'
        ? 'pending'
        : status === 'dismissed'
          ? 'blocked'
          : 'success'
    activity_events.push({
      id: `report:${row.post_id}`,
      event_type: 'post_reported',
      title: 'Post reported',
      actor_id: row.latest_reporter_id ? String(row.latest_reporter_id) : null,
      actor_name: null,
      actor_username: null,
      target_id: String(row.post_id),
      target_label: `${row.report_count} report${row.report_count === 1 ? '' : 's'} · ${String(row.latest_reason || '').replace(/_/g, ' ')}`,
      status: mappedStatus,
      severity:
        HIGH_PRIORITY_REASONS.includes(row.latest_reason as PostReportReason)
          ? 'critical'
          : mappedStatus === 'pending'
            ? 'high'
            : 'medium',
      timestamp: String(row.last_reported_at),
      href: `/admin/reports/${row.post_id}`,
      metadata: {
        report_count: row.report_count,
        reason: row.latest_reason,
        status,
      },
    })
  }

  for (const row of recentActions.data || []) {
    const admin = row.admin_id ? profiles.get(String(row.admin_id)) : null
    activity_events.push({
      id: `action:${row.id}`,
      event_type: 'report_action',
      title: `Admin ${String(row.action).replace(/_/g, ' ')}`,
      actor_id: row.admin_id ? String(row.admin_id) : null,
      actor_name: profileName(admin || null),
      actor_username: admin?.username || null,
      target_id: String(row.post_id),
      target_label: `Post ${String(row.post_id).slice(0, 8)}…`,
      status: row.action === 'remove_post' || row.action === 'suspend_user' ? 'warning' : 'success',
      severity: row.action === 'suspend_user' ? 'high' : 'medium',
      timestamp: row.created_at,
      href: `/admin/reports/${row.post_id}`,
      metadata: { action: row.action, notes: row.notes },
    })
  }

  for (const row of callStats.recent) {
    const id = String(row.id)
    const status = String(row.status || 'unknown')
    const initiator = typeof row.created_by === 'string' ? profiles.get(row.created_by) : null
    let event_type: MonitoringEventType = 'call_started'
    let mappedStatus: MonitoringEventStatus = 'info'
    if (status === 'failed') {
      event_type = 'call_failed'
      mappedStatus = 'failed'
    } else if (status === 'missed' || status === 'declined') {
      event_type = 'call_missed'
      mappedStatus = 'warning'
    } else if (status === 'ended') {
      event_type = 'call_ended'
      mappedStatus = 'success'
    } else if (ACTIVE_CALL_STATUSES.includes(status as (typeof ACTIVE_CALL_STATUSES)[number])) {
      event_type = 'call_started'
      mappedStatus = 'pending'
    }

    activity_events.push({
      id: `call:${id}`,
      event_type,
      title:
        event_type === 'call_failed'
          ? 'Call failed'
          : event_type === 'call_missed'
            ? 'Call missed'
            : event_type === 'call_ended'
              ? 'Call ended'
              : 'Call started',
      actor_id: typeof row.created_by === 'string' ? row.created_by : null,
      actor_name: profileName(initiator || null),
      actor_username: initiator?.username || null,
      target_id: id,
      target_label: `${callTypeOf(row)} · ${status}`,
      status: mappedStatus,
      severity: eventSeverity(event_type, mappedStatus),
      timestamp: String(row.created_at || row.started_at || nowIso()),
      href: null,
      metadata: {
        call_id: row.call_id,
        call_type: callTypeOf(row),
        provider: providerOf(row),
        duration_seconds: row.duration_seconds,
        status,
      },
    })
  }

  activity_events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  let filteredEvents = activity_events
  if (options.eventType && options.eventType !== 'all') {
    filteredEvents = filteredEvents.filter((e) => e.event_type === options.eventType)
  }
  if (options.status && options.status !== 'all') {
    filteredEvents = filteredEvents.filter((e) => e.status === options.status)
  }
  if (options.severity && options.severity !== 'all') {
    filteredEvents = filteredEvents.filter((e) => e.severity === options.severity)
  }
  if (search) {
    filteredEvents = filteredEvents.filter((e) => {
      const haystack = [
        e.title,
        e.actor_name,
        e.actor_username,
        e.target_label,
        e.event_type,
        e.target_id,
        e.actor_id,
        JSON.stringify(e.metadata),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(search)
    })
  }

  const recent_content: MonitoringContentRow[] = []

  for (const row of recentReports.data || []) {
    const author = row.author_id ? profiles.get(String(row.author_id)) : null
    recent_content.push({
      id: String(row.post_id),
      content_type: 'post',
      preview: `Reported post · ${String(row.latest_reason || '').replace(/_/g, ' ')}`,
      creator_id: row.author_id ? String(row.author_id) : null,
      creator_name: profileName(author || null),
      creator_username: author?.username || null,
      reports: Number(row.report_count || 0),
      status: String(row.status || 'pending'),
      created_at: String(row.last_reported_at || row.first_reported_at),
      href: `/admin/reports/${row.post_id}`,
    })
  }

  for (const row of recentPosts.data || []) {
    if (recent_content.some((c) => c.id === row.id)) continue
    const author = profiles.get(row.author_id)
    recent_content.push({
      id: row.id,
      content_type: 'post',
      preview: truncate(row.content),
      creator_id: row.author_id,
      creator_name: profileName(author || null),
      creator_username: author?.username || null,
      reports: 0,
      status: row.is_deleted ? 'removed' : 'published',
      created_at: row.created_at,
      href: `/post/${row.id}`,
    })
  }

  for (const row of recentReels.data || []) {
    const author = profiles.get(row.author_id)
    recent_content.push({
      id: row.id,
      content_type: 'reel',
      preview: truncate(row.title || row.description) || 'Reel',
      creator_id: row.author_id,
      creator_name: profileName(author || null),
      creator_username: author?.username || null,
      reports: 0,
      status: row.is_deleted ? 'removed' : 'published',
      created_at: row.created_at,
      href: `/reels?id=${row.id}`,
    })
  }

  for (const row of recentListings.data || []) {
    const seller = profiles.get(row.seller_id)
    recent_content.push({
      id: row.id,
      content_type: 'listing',
      preview: truncate(row.title),
      creator_id: row.seller_id,
      creator_name: profileName(seller || null),
      creator_username: seller?.username || null,
      reports: 0,
      status: row.is_available === false ? 'removed' : 'listed',
      created_at: row.created_at,
      href: `/marketplace/product/${row.id}`,
    })
  }

  recent_content.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const recent_calls: MonitoringCallRow[] = callStats.recent.map((row) => {
    const initiator =
      typeof row.created_by === 'string' ? profiles.get(row.created_by) : null
    return {
      id: String(row.id),
      call_id: typeof row.call_id === 'string' ? row.call_id : null,
      initiator_id: typeof row.created_by === 'string' ? row.created_by : null,
      initiator_name: profileName(initiator || null),
      initiator_username: initiator?.username || null,
      participant_count: participantCount(row),
      call_type: callTypeOf(row),
      provider: providerOf(row),
      started_at:
        (typeof row.started_at === 'string' && row.started_at) ||
        (typeof row.created_at === 'string' ? row.created_at : null),
      ended_at: typeof row.ended_at === 'string' ? row.ended_at : null,
      duration_seconds:
        row.duration_seconds == null ? null : Number(row.duration_seconds) || 0,
      status: String(row.status || 'unknown'),
    }
  })

  const admin_actions: MonitoringAdminAction[] = (recentActions.data || []).map((row) => {
    const admin = row.admin_id ? profiles.get(String(row.admin_id)) : null
    return {
      id: row.id,
      admin_id: row.admin_id ? String(row.admin_id) : null,
      admin_name: profileName(admin || null),
      admin_username: admin?.username || null,
      action: String(row.action),
      target_id: String(row.post_id),
      target_label: `Post ${String(row.post_id).slice(0, 8)}…`,
      notes: row.notes,
      timestamp: row.created_at,
      href: `/admin/reports/${row.post_id}`,
    }
  })

  // Soft-fail noisy select errors without aborting the whole page.
  for (const result of [
    recentProfiles,
    recentPosts,
    recentReels,
    recentListings,
    recentReports,
    recentActions,
  ]) {
    if (result.error) {
      console.warn('[monitoring] recent query warning:', result.error.message)
    }
  }

  return {
    range,
    generated_at: new Date().toISOString(),
    kpis: {
      active_users: userStats.active_users,
      online_users: onlineUsers,
      new_users: userStats.new_users_today,
      posts_in_period: postsInPeriod,
      pending_reports: reportStats.pending,
      under_review_reports: reportStats.under_review,
      resolved_reports: reportStats.resolved,
      dismissed_reports: reportStats.dismissed,
      high_priority_reports: highPriority,
      active_calls: callStats.active,
      calls_in_period: callStats.total,
      audio_calls: callStats.audio,
      video_calls: callStats.video,
      failed_calls: callStats.failed,
      missed_calls: callStats.missed,
      average_call_duration_seconds: callStats.avgDuration,
      comments_in_period: commentsInPeriod,
      reactions_in_period: reactionsInPeriod,
      messages_in_period: messagesInPeriod,
      reels_in_period: reelsInPeriod,
      listings_in_period: listingsInPeriod,
      removed_posts: removedPosts,
      open_feedback: openFeedbackNew + openFeedbackReview,
    },
    activity_chart: {
      users: usersInPeriod,
      posts: postsInPeriod,
      comments: commentsInPeriod,
      reactions: reactionsInPeriod,
      messages: messagesInPeriod,
      calls: callStats.total,
      reels: reelsInPeriod,
      listings: listingsInPeriod,
    },
    report_reasons: reportReasons,
    call_status_breakdown: callStats.breakdown,
    activity_events: filteredEvents.slice(0, 40),
    recent_content: recent_content.slice(0, 15),
    recent_calls,
    admin_actions,
    services,
  }
}

function nowIso() {
  return new Date().toISOString()
}
