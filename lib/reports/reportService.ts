import type { SupabaseClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications/createNotification'
import { suspendAdminUser } from '@/lib/marketplace/adminUserService'
import { sendReportReceivedEmail } from '@/shared/services/emailService'
import { lookupAdminContacts, lookupUserContact } from '@/lib/emails/recipients'
import {
  POST_REPORT_ACTIONS,
  POST_REPORT_REASONS,
  POST_REPORT_REASON_LABELS,
  POST_REPORT_STATUSES,
  type ApplyReportActionInput,
  type CreatePostReportInput,
  type ListReportGroupsFilters,
  type PostReportActionRow,
  type PostReportActionType,
  type PostReportGroup,
  type PostReportGroupDetail,
  type PostReportReason,
  type PostReportRow,
  type PostReportStats,
  type PostReportStatus,
  type PostReportWithReporter,
  type ReasonCounts,
  type ReportProfile,
  type ReportedPostSummary,
} from './types'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function sanitizeIlike(value: string) {
  return value.replace(/[%_,.()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

const PROFILE_SELECT = 'id, username, full_name, avatar_url'

const POST_SUMMARY_SELECT = `
  id,
  content,
  media_urls,
  media_type,
  is_deleted,
  author_id,
  created_at,
  author:profiles!posts_author_id_fkey (${PROFILE_SELECT})
`

export function isPostReportReason(value: unknown): value is PostReportReason {
  return typeof value === 'string' && (POST_REPORT_REASONS as readonly string[]).includes(value)
}

export function isPostReportStatus(value: unknown): value is PostReportStatus {
  return typeof value === 'string' && (POST_REPORT_STATUSES as readonly string[]).includes(value)
}

export function isPostReportActionType(value: unknown): value is PostReportActionType {
  return typeof value === 'string' && (POST_REPORT_ACTIONS as readonly string[]).includes(value)
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
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

function mapPostSummary(row: unknown): ReportedPostSummary | null {
  if (!row || typeof row !== 'object') return null
  const p = row as Record<string, unknown>
  if (typeof p.id !== 'string') return null
  return {
    id: p.id,
    content: typeof p.content === 'string' ? p.content : null,
    media_urls: Array.isArray(p.media_urls)
      ? p.media_urls.filter((u): u is string => typeof u === 'string')
      : null,
    media_type: typeof p.media_type === 'string' ? p.media_type : null,
    is_deleted: Boolean(p.is_deleted),
    author_id: typeof p.author_id === 'string' ? p.author_id : '',
    created_at: typeof p.created_at === 'string' ? p.created_at : '',
    author: mapProfile(p.author),
  }
}

async function fetchProfilesByIds(
  client: SupabaseClient,
  ids: Array<string | null | undefined>
): Promise<Map<string, ReportProfile>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  const map = new Map<string, ReportProfile>()
  if (unique.length === 0) return map

  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_SELECT)
    .in('id', unique)

  if (error) throw new Error(error.message)

  for (const row of data || []) {
    const profile = mapProfile(row)
    if (profile) map.set(profile.id, profile)
  }
  return map
}

async function resolveAuthorIds(
  client: SupabaseClient,
  authorQuery: string
): Promise<string[]> {
  const q = sanitizeIlike(authorQuery)
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

export function emptyReportStats(): PostReportStats {
  return {
    total: 0,
    pending: 0,
    under_review: 0,
    resolved: 0,
    dismissed: 0,
  }
}

export async function createPostReport(
  client: SupabaseClient,
  input: CreatePostReportInput
): Promise<PostReportRow> {
  if (!isUuid(input.post_id)) {
    throw new Error('Invalid post')
  }
  if (!isPostReportReason(input.reason)) {
    throw new Error('Please select a valid report reason')
  }

  const { data: post, error: postError } = await client
    .from('posts')
    .select('id, author_id, is_deleted')
    .eq('id', input.post_id)
    .maybeSingle()

  if (postError) throw new Error(postError.message)
  if (!post || post.is_deleted) {
    throw new Error('Post not found')
  }
  if (post.author_id === input.reported_by) {
    throw new Error('You cannot report your own post')
  }

  const { data, error } = await client
    .from('post_reports')
    .insert({
      post_id: input.post_id,
      reported_by: input.reported_by,
      reason: input.reason,
      status: 'pending',
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('You have already reported this post for this reason')
    }
    throw new Error(error.message || 'Failed to submit report')
  }

  const report = data as PostReportRow

  try {
    const [admins, reporter] = await Promise.all([
      lookupAdminContacts(client),
      lookupUserContact(client, input.reported_by),
    ])
    const reasonLabel = POST_REPORT_REASON_LABELS[input.reason]
    await Promise.all(
      admins.map((admin) =>
        sendReportReceivedEmail(admin.email, {
          adminName: admin.name,
          reasonLabel,
          postId: input.post_id,
          reporterName: reporter?.name,
        })
      )
    )
  } catch (emailError) {
    console.error('Failed to send report received email:', emailError)
  }

  return report
}

export async function getReportStats(client: SupabaseClient): Promise<PostReportStats> {
  const { data, error } = await client
    .from('post_report_groups')
    .select('status')

  if (error) throw new Error(error.message)

  const stats = emptyReportStats()
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

export async function listReportGroups(
  client: SupabaseClient,
  filters: ListReportGroupsFilters = {}
): Promise<{ items: PostReportGroup[]; total: number }> {
  const page = Number.isFinite(filters.page) && (filters.page ?? 0) >= 0 ? (filters.page as number) : 0
  const limitRaw = Number.isFinite(filters.limit) ? (filters.limit as number) : 20
  const limit = Math.min(Math.max(limitRaw, 1), 50)
  const from = page * limit
  const to = from + limit - 1

  let query = client.from('post_report_groups').select('*', { count: 'exact' })
  let postIdFilter: string[] | null = null

  if (filters.status && filters.status !== 'all' && isPostReportStatus(filters.status)) {
    query = query.eq('status', filters.status)
  }

  if (filters.reason && filters.reason !== 'all' && isPostReportReason(filters.reason)) {
    const { data: reasonRows, error: reasonError } = await client
      .from('post_reports')
      .select('post_id')
      .eq('reason', filters.reason)
    if (reasonError) throw new Error(reasonError.message)
    const reasonPostIds = [...new Set((reasonRows || []).map((row) => row.post_id as string))]
    if (reasonPostIds.length === 0) {
      return { items: [], total: 0 }
    }
    postIdFilter = reasonPostIds
  }

  if (filters.date_from) {
    query = query.gte('last_reported_at', filters.date_from)
  }
  if (filters.date_to) {
    query = query.lte('last_reported_at', filters.date_to)
  }

  const minReports = Number(filters.min_reports)
  if (Number.isFinite(minReports) && minReports > 1) {
    query = query.gte('report_count', minReports)
  }

  if (filters.author?.trim()) {
    const authorIds = await resolveAuthorIds(client, filters.author)
    if (authorIds.length === 0) {
      return { items: [], total: 0 }
    }
    query = query.in('author_id', authorIds)
  }

  if (filters.search?.trim()) {
    const { data: searchRows, error: searchError } = await client.rpc(
      'search_reported_post_ids',
      { p_query: filters.search.trim() }
    )
    if (searchError) throw new Error(searchError.message)
    const ids: string[] = []
    for (const row of (Array.isArray(searchRows) ? searchRows : []) as Array<{ post_id?: unknown }>) {
      if (typeof row?.post_id === 'string') ids.push(row.post_id)
    }
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) {
      return { items: [], total: 0 }
    }
    if (postIdFilter) {
      const allow = new Set(uniqueIds)
      postIdFilter = postIdFilter.filter((id) => allow.has(id))
    } else {
      postIdFilter = uniqueIds
    }
  }

  if (postIdFilter !== null) {
    if (postIdFilter.length === 0) {
      return { items: [], total: 0 }
    }
    query = query.in('post_id', postIdFilter)
  }

  const { data, error, count } = await query
    .order('last_reported_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)

  const rows = data || []
  const postIds = rows.map((row) => row.post_id as string)
  const reporterIds = rows.map((row) => row.latest_reporter_id as string | null)

  const [{ data: posts, error: postsError }, reporters] = await Promise.all([
    postIds.length
      ? client.from('posts').select(POST_SUMMARY_SELECT).in('id', postIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    fetchProfilesByIds(client, reporterIds),
  ])

  if (postsError) throw new Error(postsError.message)

  const postsById = new Map<string, ReportedPostSummary>()
  for (const post of posts || []) {
    const mapped = mapPostSummary(post)
    if (mapped) postsById.set(mapped.id, mapped)
  }

  const items: PostReportGroup[] = rows.map((row) => {
    const postId = row.post_id as string
    const latestReporterId = (row.latest_reporter_id as string | null) || null
    return {
      post_id: postId,
      author_id: row.author_id as string,
      report_count: Number(row.report_count) || 0,
      first_reported_at: row.first_reported_at as string,
      last_reported_at: row.last_reported_at as string,
      latest_report_id: row.latest_report_id as string,
      latest_reason: row.latest_reason as PostReportReason,
      latest_reporter_id: latestReporterId,
      status: row.status as PostReportStatus,
      reason_counts: mapReasonCounts(row.reason_counts),
      post: postsById.get(postId) || null,
      latest_reporter: latestReporterId ? reporters.get(latestReporterId) || null : null,
    }
  })

  return { items, total: count ?? items.length }
}

export async function getReportGroupDetail(
  client: SupabaseClient,
  postId: string,
  options?: { markUnderReview?: boolean; reviewerId?: string }
): Promise<PostReportGroupDetail | null> {
  if (!isUuid(postId)) return null

  const { data: groupRow, error: groupError } = await client
    .from('post_report_groups')
    .select('*')
    .eq('post_id', postId)
    .maybeSingle()

  if (groupError) throw new Error(groupError.message)
  if (!groupRow) return null

  if (options?.markUnderReview && groupRow.status === 'pending' && options.reviewerId) {
    await client
      .from('post_reports')
      .update({
        status: 'under_review',
        reviewed_by: options.reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('post_id', postId)
      .eq('status', 'pending')

    const { data: refreshed } = await client
      .from('post_report_groups')
      .select('*')
      .eq('post_id', postId)
      .maybeSingle()
    if (refreshed) Object.assign(groupRow, refreshed)
  }

  const [{ data: postRow, error: postError }, { data: reportRows, error: reportsError }, { data: actionRows, error: actionsError }] =
    await Promise.all([
      client.from('posts').select(POST_SUMMARY_SELECT).eq('id', postId).maybeSingle(),
      client
        .from('post_reports')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false }),
      client
        .from('post_report_actions')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false }),
    ])

  if (postError) throw new Error(postError.message)
  if (reportsError) throw new Error(reportsError.message)
  if (actionsError) throw new Error(actionsError.message)

  const reports = (reportRows || []) as PostReportRow[]
  const actionsRaw = (actionRows || []) as Array<
    Omit<PostReportActionRow, 'admin'> & { metadata?: Record<string, unknown> | null }
  >

  const profiles = await fetchProfilesByIds(client, [
    groupRow.latest_reporter_id as string | null,
    ...reports.map((r) => r.reported_by),
    ...actionsRaw.map((a) => a.admin_id),
  ])

  const actions: PostReportActionRow[] = actionsRaw.map((row) => ({
    id: row.id,
    post_id: row.post_id,
    admin_id: row.admin_id,
    action: row.action,
    notes: row.notes,
    metadata: row.metadata || {},
    created_at: row.created_at,
    admin: row.admin_id ? profiles.get(row.admin_id) || null : null,
  }))

  const reportsWithReporters: PostReportWithReporter[] = reports.map((row) => ({
    ...row,
    reporter: row.reported_by ? profiles.get(row.reported_by) || null : null,
  }))

  return {
    post_id: groupRow.post_id as string,
    author_id: groupRow.author_id as string,
    report_count: Number(groupRow.report_count) || 0,
    first_reported_at: groupRow.first_reported_at as string,
    last_reported_at: groupRow.last_reported_at as string,
    latest_report_id: groupRow.latest_report_id as string,
    latest_reason: groupRow.latest_reason as PostReportReason,
    latest_reporter_id: (groupRow.latest_reporter_id as string | null) || null,
    status: groupRow.status as PostReportStatus,
    reason_counts: mapReasonCounts(groupRow.reason_counts),
    post: mapPostSummary(postRow),
    latest_reporter: groupRow.latest_reporter_id
      ? profiles.get(groupRow.latest_reporter_id as string) || null
      : null,
    reports: reportsWithReporters,
    actions,
  }
}

async function hidePost(client: SupabaseClient, postId: string) {
  const { error } = await client
    .from('posts')
    .update({ is_deleted: true })
    .eq('id', postId)

  if (error) throw new Error(error.message || 'Failed to remove post')
}

async function setReportsStatus(
  client: SupabaseClient,
  postId: string,
  status: Extract<PostReportStatus, 'resolved' | 'dismissed'>,
  adminId: string
) {
  const { error } = await client
    .from('post_reports')
    .update({
      status,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('post_id', postId)
    .in('status', ['pending', 'under_review'])

  if (error) throw new Error(error.message)
}

async function insertAction(
  client: SupabaseClient,
  input: ApplyReportActionInput,
  metadata: Record<string, unknown>
) {
  const { error } = await client.from('post_report_actions').insert({
    post_id: input.post_id,
    admin_id: input.admin_id,
    action: input.action,
    notes: input.notes?.trim() || null,
    metadata,
  })
  if (error) throw new Error(error.message)
}

export async function applyReportAction(
  client: SupabaseClient,
  input: ApplyReportActionInput
): Promise<PostReportGroupDetail> {
  if (!isUuid(input.post_id)) {
    throw new Error('Invalid post')
  }
  if (!isPostReportActionType(input.action)) {
    throw new Error('Invalid action')
  }

  const { data: post, error: postError } = await client
    .from('posts')
    .select('id, author_id, is_deleted, content')
    .eq('id', input.post_id)
    .maybeSingle()

  if (postError) throw new Error(postError.message)
  if (!post) throw new Error('Post not found')

  const { count } = await client
    .from('post_reports')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', input.post_id)

  if (!count) {
    throw new Error('No reports found for this post')
  }

  if (input.action === 'suspend_user') {
    await suspendAdminUser(client, post.author_id, input.admin_id)
  }

  const shouldRemove =
    input.action === 'remove_post' ||
    ((input.action === 'warn_user' || input.action === 'suspend_user') && Boolean(input.remove_post))

  let removedPost = false
  if (shouldRemove && !post.is_deleted) {
    await hidePost(client, input.post_id)
    removedPost = true
  }

  if (input.action === 'keep_post') {
    await setReportsStatus(client, input.post_id, 'dismissed', input.admin_id)
  } else if (input.action === 'remove_post' || input.action === 'suspend_user' || shouldRemove) {
    await setReportsStatus(client, input.post_id, 'resolved', input.admin_id)
  } else {
    await client
      .from('post_reports')
      .update({
        status: 'under_review',
        reviewed_by: input.admin_id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('post_id', input.post_id)
      .eq('status', 'pending')
  }

  if (input.action === 'warn_user') {
    const preview = typeof post.content === 'string' ? post.content.trim().slice(0, 80) : ''
    await createNotification({
      user_id: post.author_id,
      type: 'system',
      title: 'Community guidelines warning',
      message: removedPost
        ? 'A post you shared was removed after a community guidelines review. Please follow ConnectAfrik guidelines going forward.'
        : 'A post you shared was reported and reviewed. Please follow ConnectAfrik community guidelines. Further violations may lead to removal or account restrictions.',
      data: {
        post_id: input.post_id,
        warning: true,
        removed: removedPost,
        preview,
      },
    })
  }

  if (input.action === 'suspend_user') {
    await createNotification({
      user_id: post.author_id,
      type: 'system',
      title: 'Account suspended',
      message:
        'Your account has been suspended following a serious community guidelines violation. Contact support if you believe this was a mistake.',
      data: {
        post_id: input.post_id,
        suspended: true,
        removed: removedPost,
      },
    })
  }

  await insertAction(client, input, {
    removed_post: removedPost,
    already_removed: Boolean(post.is_deleted) && shouldRemove,
  })

  const detail = await getReportGroupDetail(client, input.post_id)
  if (!detail) throw new Error('Failed to load report after action')
  return detail
}
