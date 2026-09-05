export const POST_REPORT_REASONS = [
  'sexual_content',
  'violent_or_repulsive',
  'hateful_or_abusive',
  'harmful_or_dangerous',
  'spam_or_misleading',
  'child_abuse',
] as const

export type PostReportReason = (typeof POST_REPORT_REASONS)[number]

export const POST_REPORT_REASON_LABELS: Record<PostReportReason, string> = {
  sexual_content: 'Sexual content',
  violent_or_repulsive: 'Violent or repulsive content',
  hateful_or_abusive: 'Hateful or abusive content',
  harmful_or_dangerous: 'Harmful or dangerous acts',
  spam_or_misleading: 'Spam or misleading',
  child_abuse: 'Child abuse',
}

export const POST_REPORT_REASON_OPTIONS: { value: PostReportReason; label: string }[] =
  POST_REPORT_REASONS.map((value) => ({
    value,
    label: POST_REPORT_REASON_LABELS[value],
  }))

export const POST_REPORT_STATUSES = [
  'pending',
  'under_review',
  'resolved',
  'dismissed',
] as const

export type PostReportStatus = (typeof POST_REPORT_STATUSES)[number]

export const POST_REPORT_STATUS_LABELS: Record<PostReportStatus, string> = {
  pending: 'Pending',
  under_review: 'Under Review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
}

export const POST_REPORT_STATUS_OPTIONS: { value: PostReportStatus; label: string }[] =
  POST_REPORT_STATUSES.map((value) => ({
    value,
    label: POST_REPORT_STATUS_LABELS[value],
  }))

export const POST_REPORT_ACTIONS = [
  'keep_post',
  'remove_post',
  'warn_user',
  'suspend_user',
] as const

export type PostReportActionType = (typeof POST_REPORT_ACTIONS)[number]

export const POST_REPORT_ACTION_LABELS: Record<PostReportActionType, string> = {
  keep_post: 'Keep Post',
  remove_post: 'Remove Post',
  warn_user: 'Warn User',
  suspend_user: 'Suspend User',
}

export interface ReportProfile {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
}

export interface PostReportRow {
  id: string
  post_id: string
  reported_by: string | null
  reason: PostReportReason
  status: PostReportStatus
  created_at: string
  updated_at: string
  reviewed_by: string | null
  reviewed_at: string | null
}

export interface PostReportWithReporter extends PostReportRow {
  reporter: ReportProfile | null
}

export interface PostReportActionRow {
  id: string
  post_id: string
  admin_id: string | null
  action: PostReportActionType
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  admin: ReportProfile | null
}

export interface ReportedPostSummary {
  id: string
  content: string | null
  media_urls: string[] | null
  media_type: string | null
  is_deleted: boolean
  author_id: string
  created_at: string
  author: ReportProfile | null
}

export type ReasonCounts = Partial<Record<PostReportReason, number>>

export interface PostReportGroup {
  post_id: string
  author_id: string
  report_count: number
  first_reported_at: string
  last_reported_at: string
  latest_report_id: string
  latest_reason: PostReportReason
  latest_reporter_id: string | null
  status: PostReportStatus
  reason_counts: ReasonCounts
  post: ReportedPostSummary | null
  latest_reporter: ReportProfile | null
}

export interface PostReportGroupDetail extends PostReportGroup {
  reports: PostReportWithReporter[]
  actions: PostReportActionRow[]
}

export interface PostReportStats {
  total: number
  pending: number
  under_review: number
  resolved: number
  dismissed: number
}

export interface ListReportGroupsFilters {
  status?: PostReportStatus | 'all'
  reason?: PostReportReason | 'all'
  search?: string
  date_from?: string
  date_to?: string
  min_reports?: number
  author?: string
  page?: number
  limit?: number
}

export interface CreatePostReportInput {
  post_id: string
  reported_by: string
  reason: PostReportReason
}

export interface ApplyReportActionInput {
  post_id: string
  admin_id: string
  action: PostReportActionType
  notes?: string | null
  remove_post?: boolean
}
