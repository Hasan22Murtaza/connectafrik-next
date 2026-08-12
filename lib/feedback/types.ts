export const FEEDBACK_TYPES = [
  'feature_request',
  'improvement_suggestion',
  'bug_report',
  'ui_ux_feedback',
  'general_feedback',
  'other',
] as const

export type FeedbackType = (typeof FEEDBACK_TYPES)[number]

export const FEEDBACK_STATUSES = [
  'new',
  'under_review',
  'planned',
  'in_progress',
  'completed',
  'rejected',
] as const

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

export interface FeedbackRow {
  id: string
  user_id: string | null
  user_name: string | null
  email: string | null
  feedback_type: FeedbackType
  title: string
  message: string
  attachment_url: string | null
  attachment_path: string | null
  status: FeedbackStatus
  internal_notes: string | null
  admin_response: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface FeedbackWithUser extends FeedbackRow {
  profiles?: {
    id: string
    full_name: string | null
    username: string | null
    avatar_url: string | null
    email?: string | null
  } | null
}

export interface FeedbackStats {
  total: number
  new: number
  under_review: number
  planned: number
  in_progress: number
  completed: number
  rejected: number
}

export interface CreateFeedbackInput {
  feedback_type: FeedbackType
  title: string
  message: string
  email?: string | null
  user_name?: string | null
  user_id?: string | null
  attachment_url?: string | null
  attachment_path?: string | null
}

export interface UpdateFeedbackInput {
  status?: FeedbackStatus
  internal_notes?: string | null
  admin_response?: string | null
  reviewed_by?: string | null
}

export interface ListFeedbackFilters {
  status?: FeedbackStatus | 'all'
  type?: FeedbackType | 'all'
  search?: string
  date_from?: string
  date_to?: string
  page?: number
  limit?: number
}
