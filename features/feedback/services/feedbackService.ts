import { apiClient } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'
import type {
  FeedbackStats,
  FeedbackStatus,
  FeedbackType,
  FeedbackWithUser,
} from '@/lib/feedback/types'

export const FEEDBACK_TYPE_OPTIONS: { value: FeedbackType; label: string }[] = [
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'improvement_suggestion', label: 'Improvement Suggestion' },
  { value: 'bug_report', label: 'Bug Report' },
  { value: 'ui_ux_feedback', label: 'UI/UX Feedback' },
  { value: 'general_feedback', label: 'General Feedback' },
  { value: 'other', label: 'Other' },
]

export const FEEDBACK_STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
]

export interface SubmitFeedbackInput {
  feedback_type: FeedbackType
  title: string
  message: string
  email?: string
  user_name?: string
  attachment?: File | null
}

export interface AdminFeedbackListResult {
  items: FeedbackWithUser[]
  total: number
  page: number
  limit: number
  stats: FeedbackStats
}

export async function submitFeedback(input: SubmitFeedbackInput): Promise<void> {
  const form = new FormData()
  form.append('feedback_type', input.feedback_type)
  form.append('title', input.title)
  form.append('message', input.message)
  if (input.email) form.append('email', input.email)
  if (input.user_name) form.append('user_name', input.user_name)
  if (input.attachment) form.append('attachment', input.attachment)

  const { data: sessionData } = await supabase.auth.getSession()
  const headers: Record<string, string> = {}
  if (sessionData.session?.access_token) {
    headers.Authorization = `Bearer ${sessionData.session.access_token}`
  }

  const response = await fetch('/api/feedback', {
    method: 'POST',
    headers,
    body: form,
  })

  let body: any = null
  try {
    body = await response.json()
  } catch {
    /* ignore */
  }

  if (!response.ok || body?.success === false) {
    throw new Error(body?.message || 'Failed to submit feedback')
  }
}

export async function listAdminFeedback(params: {
  status?: FeedbackStatus | 'all'
  type?: FeedbackType | 'all'
  search?: string
  date_from?: string
  date_to?: string
  page?: number
  limit?: number
  include_stats?: boolean
}): Promise<AdminFeedbackListResult> {
  return apiClient.get<AdminFeedbackListResult>('/api/admin/feedback', {
    status: params.status,
    type: params.type,
    search: params.search,
    date_from: params.date_from,
    date_to: params.date_to,
    page: params.page,
    limit: params.limit,
    include_stats: params.include_stats,
  })
}

export async function getAdminFeedback(id: string): Promise<FeedbackWithUser> {
  return apiClient.get<FeedbackWithUser>(`/api/admin/feedback/${id}`)
}

export async function updateAdminFeedback(
  id: string,
  updates: {
    status?: FeedbackStatus
    internal_notes?: string | null
    admin_response?: string | null
  }
): Promise<FeedbackWithUser> {
  return apiClient.patch<FeedbackWithUser>(`/api/admin/feedback/${id}`, updates)
}

export async function deleteAdminFeedback(id: string): Promise<void> {
  await apiClient.delete(`/api/admin/feedback/${id}`)
}
