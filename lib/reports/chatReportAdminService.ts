import type { SupabaseClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications/createNotification'
import { suspendAdminUser } from '@/lib/marketplace/adminUserService'
import {
  CHAT_USER_REPORT_ACTIONS,
  POST_REPORT_REASONS,
  POST_REPORT_STATUSES,
  type ApplyChatReportActionInput,
  type ChatReportedMessageSnapshot,
  type ChatUserReportActionRow,
  type ChatUserReportActionType,
  type ChatUserReportGroup,
  type ChatUserReportGroupDetail,
  type ChatUserReportRow,
  type ChatUserReportWithReporter,
  type ListChatReportGroupsFilters,
  type PostReportReason,
  type PostReportStats,
  type PostReportStatus,
  type ReasonCounts,
  type ReportProfile,
} from './types'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PROFILE_SELECT = 'id, username, full_name, avatar_url'

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

function sanitizeIlike(value: string) {
  return value.replace(/[%_,.()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

export function isChatUserReportActionType(
  value: unknown
): value is ChatUserReportActionType {
  return (
    typeof value === 'string' &&
    (CHAT_USER_REPORT_ACTIONS as readonly string[]).includes(value)
  )
}

function isPostReportReason(value: unknown): value is PostReportReason {
  return typeof value === 'string' && (POST_REPORT_REASONS as readonly string[]).includes(value)
}

function isPostReportStatus(value: unknown): value is PostReportStatus {
  return typeof value === 'string' && (POST_REPORT_STATUSES as readonly string[]).includes(value)
}

function mapProfile(row: unknown): ReportProfile | null {
  if (!row || typeof row !== 'object') return null
  const p = row as Record<string, unknown>
  if (typeof p.id !== 'string') return null
  return {
    id: p.id,
    username: typeof p.username === 'string' ? p.username : null,
    full_name: typeof p.full_name === 'string' ? p.full_name : null,
    avatar_url: typeof p.avatar_url === 'string' ? p.avatar_url : null,
  }
}

function mapReasonCounts(value: unknown): ReasonCounts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const counts: ReasonCounts = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!isPostReportReason(key)) continue
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(n) && n > 0) counts[key] = n
  }
  return counts
}

function sanitizeMessageSnapshot(value: unknown): ChatReportedMessageSnapshot[] {
  if (!Array.isArray(value)) return []
  const out: ChatReportedMessageSnapshot[] = []
  for (const item of value.slice(0, 5)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || typeof row.sender_id !== 'string') continue
    out.push({
      id: row.id,
      sender_id: row.sender_id,
      content: typeof row.content === 'string' ? row.content.slice(0, 2000) : null,
      created_at: typeof row.created_at === 'string' ? row.created_at : '',
      message_type: typeof row.message_type === 'string' ? row.message_type : null,
      has_attachments: Boolean(row.has_attachments),
    })
  }
  return out
}

function mapChatReportRow(row: Record<string, unknown>): ChatUserReportRow {
  return {
    id: row.id as string,
    thread_id: row.thread_id as string,
    reported_user_id: row.reported_user_id as string,
    reported_by: (row.reported_by as string | null) || null,
    reason: row.reason as PostReportReason,
    notes: typeof row.notes === 'string' ? row.notes : null,
    message_snapshot: sanitizeMessageSnapshot(row.message_snapshot),
    status: row.status as PostReportStatus,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    reviewed_by: (row.reviewed_by as string | null) || null,
    reviewed_at: (row.reviewed_at as string | null) || null,
  }
}

async function fetchProfilesByIds(
  client: SupabaseClient,
  ids: Array<string | null | undefined>
): Promise<Map<string, ReportProfile>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  const map = new Map<string, ReportProfile>()
  if (unique.length === 0) return map

  const { data, error } = await client.from('profiles').select(PROFILE_SELECT).in('id', unique)
  if (error) throw new Error(error.message)

  for (const row of data || []) {
    const profile = mapProfile(row)
    if (profile) map.set(profile.id, profile)
  }
  return map
}

async function resolveProfileIds(
  client: SupabaseClient,
  query: string
): Promise<string[]> {
  const q = sanitizeIlike(query)
  if (!q) return []
  if (isUuid(q)) return [q]

  const { data, error } = await client
    .from('profiles')
    .select('id')
    .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
    .limit(100)

  if (error) throw new Error(error.message)
  return (data || []).map((row) => row.id as string)
}

export function emptyChatReportStats(): PostReportStats {
  return {
    total: 0,
    pending: 0,
    under_review: 0,
    resolved: 0,
    dismissed: 0,
  }
}

export async function getChatReportStats(
  client: SupabaseClient
): Promise<PostReportStats> {
  const { data, error } = await client.from('chat_user_report_groups').select('status')
  if (error) throw new Error(error.message)

  const stats = emptyChatReportStats()
  for (const row of data || []) {
    stats.total += 1
    const status = row.status as PostReportStatus
    if (
      status === 'pending' ||
      status === 'under_review' ||
      status === 'resolved' ||
      status === 'dismissed'
    ) {
      stats[status] += 1
    }
  }
  return stats
}

export async function listChatReportGroups(
  client: SupabaseClient,
  filters: ListChatReportGroupsFilters = {}
): Promise<{ items: ChatUserReportGroup[]; total: number }> {
  const page =
    Number.isFinite(filters.page) && (filters.page ?? 0) >= 0 ? (filters.page as number) : 0
  const limitRaw = Number.isFinite(filters.limit) ? (filters.limit as number) : 20
  const limit = Math.min(Math.max(limitRaw, 1), 50)
  const from = page * limit
  const to = from + limit - 1

  let query = client.from('chat_user_report_groups').select('*', { count: 'exact' })
  let threadIdFilter: string[] | null = null

  if (filters.status && filters.status !== 'all' && isPostReportStatus(filters.status)) {
    query = query.eq('status', filters.status)
  }

  if (filters.reason && filters.reason !== 'all' && isPostReportReason(filters.reason)) {
    const { data: reasonRows, error: reasonError } = await client
      .from('chat_user_reports')
      .select('thread_id')
      .eq('reason', filters.reason)
    if (reasonError) throw new Error(reasonError.message)
    const reasonThreadIds = [
      ...new Set((reasonRows || []).map((row) => row.thread_id as string)),
    ]
    if (reasonThreadIds.length === 0) return { items: [], total: 0 }
    threadIdFilter = reasonThreadIds
  }

  if (filters.date_from) query = query.gte('last_reported_at', filters.date_from)
  if (filters.date_to) query = query.lte('last_reported_at', filters.date_to)

  const minReports = Number(filters.min_reports)
  if (Number.isFinite(minReports) && minReports > 1) {
    query = query.gte('report_count', minReports)
  }

  if (filters.reported_user?.trim()) {
    const userIds = await resolveProfileIds(client, filters.reported_user)
    if (userIds.length === 0) return { items: [], total: 0 }
    query = query.in('reported_user_id', userIds)
  }

  if (filters.search?.trim()) {
    const { data: searchRows, error: searchError } = await client.rpc(
      'search_reported_chat_thread_ids',
      { p_query: filters.search.trim() }
    )
    if (searchError) throw new Error(searchError.message)
    const ids: string[] = []
    for (const row of (Array.isArray(searchRows) ? searchRows : []) as Array<{
      thread_id?: unknown
    }>) {
      if (typeof row?.thread_id === 'string') ids.push(row.thread_id)
    }
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return { items: [], total: 0 }
    if (threadIdFilter) {
      const allow = new Set(uniqueIds)
      threadIdFilter = threadIdFilter.filter((id) => allow.has(id))
    } else {
      threadIdFilter = uniqueIds
    }
  }

  if (threadIdFilter !== null) {
    if (threadIdFilter.length === 0) return { items: [], total: 0 }
    query = query.in('thread_id', threadIdFilter)
  }

  const { data, error, count } = await query
    .order('last_reported_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)

  const rows = data || []
  const reportedUserIds = rows.map((row) => row.reported_user_id as string)
  const reporterIds = rows.map((row) => row.latest_reporter_id as string | null)
  const profiles = await fetchProfilesByIds(client, [...reportedUserIds, ...reporterIds])

  const items: ChatUserReportGroup[] = rows.map((row) => {
    const reportedUserId = row.reported_user_id as string
    const latestReporterId = (row.latest_reporter_id as string | null) || null
    return {
      thread_id: row.thread_id as string,
      reported_user_id: reportedUserId,
      report_count: Number(row.report_count) || 0,
      first_reported_at: row.first_reported_at as string,
      last_reported_at: row.last_reported_at as string,
      latest_report_id: row.latest_report_id as string,
      latest_reason: row.latest_reason as PostReportReason,
      latest_reporter_id: latestReporterId,
      status: row.status as PostReportStatus,
      reason_counts: mapReasonCounts(row.reason_counts),
      reported_user: profiles.get(reportedUserId) || null,
      latest_reporter: latestReporterId ? profiles.get(latestReporterId) || null : null,
    }
  })

  return { items, total: count ?? items.length }
}

export async function getChatReportGroupDetail(
  client: SupabaseClient,
  threadId: string,
  options?: { markUnderReview?: boolean; reviewerId?: string }
): Promise<ChatUserReportGroupDetail | null> {
  if (!isUuid(threadId)) return null

  const { data: groupRow, error: groupError } = await client
    .from('chat_user_report_groups')
    .select('*')
    .eq('thread_id', threadId)
    .maybeSingle()

  if (groupError) throw new Error(groupError.message)
  if (!groupRow) return null

  if (options?.markUnderReview && options.reviewerId && groupRow.status === 'pending') {
    await client
      .from('chat_user_reports')
      .update({
        status: 'under_review',
        reviewed_by: options.reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('thread_id', threadId)
      .eq('status', 'pending')
    groupRow.status = 'under_review'
  }

  const [{ data: reportRows, error: reportsError }, { data: actionRows, error: actionsError }] =
    await Promise.all([
      client
        .from('chat_user_reports')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false }),
      client
        .from('chat_user_report_actions')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false }),
    ])

  if (reportsError) throw new Error(reportsError.message)
  if (actionsError) throw new Error(actionsError.message)

  const reportsRaw = (reportRows || []) as Record<string, unknown>[]
  const actionsRaw = (actionRows || []) as Record<string, unknown>[]

  const profileIds = [
    groupRow.reported_user_id as string,
    groupRow.latest_reporter_id as string | null,
    ...reportsRaw.map((row) => row.reported_by as string | null),
    ...actionsRaw.map((row) => row.admin_id as string | null),
  ]
  const profiles = await fetchProfilesByIds(client, profileIds)

  const reports: ChatUserReportWithReporter[] = reportsRaw.map((row) => {
    const mapped = mapChatReportRow(row)
    return {
      ...mapped,
      reporter: mapped.reported_by ? profiles.get(mapped.reported_by) || null : null,
    }
  })

  const actions: ChatUserReportActionRow[] = actionsRaw.map((row) => ({
    id: row.id as string,
    thread_id: row.thread_id as string,
    admin_id: (row.admin_id as string | null) || null,
    action: row.action as ChatUserReportActionType,
    notes: typeof row.notes === 'string' ? row.notes : null,
    metadata:
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    created_at: row.created_at as string,
    admin: row.admin_id ? profiles.get(row.admin_id as string) || null : null,
  }))

  const reportedUserId = groupRow.reported_user_id as string
  const latestReporterId = (groupRow.latest_reporter_id as string | null) || null

  return {
    thread_id: threadId,
    reported_user_id: reportedUserId,
    report_count: Number(groupRow.report_count) || 0,
    first_reported_at: groupRow.first_reported_at as string,
    last_reported_at: groupRow.last_reported_at as string,
    latest_report_id: groupRow.latest_report_id as string,
    latest_reason: groupRow.latest_reason as PostReportReason,
    latest_reporter_id: latestReporterId,
    status: groupRow.status as PostReportStatus,
    reason_counts: mapReasonCounts(groupRow.reason_counts),
    reported_user: profiles.get(reportedUserId) || null,
    latest_reporter: latestReporterId ? profiles.get(latestReporterId) || null : null,
    reports,
    actions,
  }
}

async function setChatReportsStatus(
  client: SupabaseClient,
  threadId: string,
  status: Extract<PostReportStatus, 'resolved' | 'dismissed'>,
  adminId: string
) {
  const { error } = await client
    .from('chat_user_reports')
    .update({
      status,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('thread_id', threadId)
    .in('status', ['pending', 'under_review'])

  if (error) throw new Error(error.message)
}

export async function applyChatReportAction(
  client: SupabaseClient,
  input: ApplyChatReportActionInput
): Promise<ChatUserReportGroupDetail> {
  if (!isUuid(input.thread_id)) throw new Error('Invalid chat')
  if (!isChatUserReportActionType(input.action)) throw new Error('Invalid action')

  const { data: groupRow, error: groupError } = await client
    .from('chat_user_report_groups')
    .select('thread_id, reported_user_id')
    .eq('thread_id', input.thread_id)
    .maybeSingle()

  if (groupError) throw new Error(groupError.message)
  if (!groupRow) throw new Error('No reports found for this chat')

  const reportedUserId = groupRow.reported_user_id as string

  if (input.action === 'suspend_user') {
    await suspendAdminUser(client, reportedUserId, input.admin_id)
  }

  if (input.action === 'dismiss') {
    await setChatReportsStatus(client, input.thread_id, 'dismissed', input.admin_id)
  } else {
    await setChatReportsStatus(client, input.thread_id, 'resolved', input.admin_id)
  }

  if (input.action === 'warn_user') {
    await createNotification({
      user_id: reportedUserId,
      type: 'system',
      title: 'Community guidelines warning',
      message:
        'A chat you participated in was reported and reviewed. Please follow CribsTalk community guidelines. Further violations may lead to account restrictions.',
      data: {
        thread_id: input.thread_id,
        warning: true,
        source: 'chat_user_reports',
      },
    })
  }

  if (input.action === 'suspend_user') {
    await createNotification({
      user_id: reportedUserId,
      type: 'system',
      title: 'Account suspended',
      message:
        'Your account has been suspended following a serious community guidelines violation. Contact support if you believe this was a mistake.',
      data: {
        thread_id: input.thread_id,
        suspended: true,
        source: 'chat_user_reports',
      },
    })
  }

  const { error: actionError } = await client.from('chat_user_report_actions').insert({
    thread_id: input.thread_id,
    admin_id: input.admin_id,
    action: input.action,
    notes: input.notes?.trim() || null,
    metadata: {
      reported_user_id: reportedUserId,
    },
  })
  if (actionError) throw new Error(actionError.message)

  const detail = await getChatReportGroupDetail(client, input.thread_id)
  if (!detail) throw new Error('Failed to load chat report after action')
  return detail
}
