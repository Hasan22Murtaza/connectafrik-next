import { apiClient } from '@/lib/api-client'
import type {
  ChatUserReportActionType,
  ChatUserReportGroup,
  ChatUserReportGroupDetail,
  PostReportActionType,
  PostReportGroup,
  PostReportGroupDetail,
  PostReportReason,
  PostReportStats,
  PostReportStatus,
} from '@/lib/reports/types'

export interface SubmitPostReportResult {
  submitted: boolean
}

export interface AdminReportListResult {
  items: PostReportGroup[]
  total: number
  page: number
  limit: number
  stats: PostReportStats
}

export async function submitPostReport(
  postId: string,
  reason: PostReportReason
): Promise<SubmitPostReportResult> {
  return apiClient.post<SubmitPostReportResult>(`/api/posts/${postId}/report`, { reason })
}

export async function listAdminReportGroups(params: {
  status?: PostReportStatus | 'all'
  reason?: PostReportReason | 'all'
  search?: string
  date_from?: string
  date_to?: string
  author?: string
  min_reports?: number
  page?: number
  limit?: number
  include_stats?: boolean
}): Promise<AdminReportListResult> {
  return apiClient.get<AdminReportListResult>('/api/admin/reports', {
    status: params.status,
    reason: params.reason,
    search: params.search,
    date_from: params.date_from,
    date_to: params.date_to,
    author: params.author,
    min_reports: params.min_reports,
    page: params.page,
    limit: params.limit,
    include_stats: params.include_stats,
  })
}

export async function getAdminReportGroup(postId: string): Promise<PostReportGroupDetail> {
  return apiClient.get<PostReportGroupDetail>(`/api/admin/reports/${postId}`)
}

export async function applyAdminReportAction(
  postId: string,
  input: {
    action: PostReportActionType
    notes?: string
    remove_post?: boolean
  }
): Promise<PostReportGroupDetail> {
  return apiClient.post<PostReportGroupDetail>(`/api/admin/reports/${postId}/actions`, input)
}

export interface AdminChatReportListResult {
  items: ChatUserReportGroup[]
  total: number
  page: number
  limit: number
  stats: PostReportStats
}

export async function listAdminChatReportGroups(params: {
  status?: PostReportStatus | 'all'
  reason?: PostReportReason | 'all'
  search?: string
  date_from?: string
  date_to?: string
  reported_user?: string
  min_reports?: number
  page?: number
  limit?: number
  include_stats?: boolean
}): Promise<AdminChatReportListResult> {
  return apiClient.get<AdminChatReportListResult>('/api/admin/chat-reports', {
    status: params.status,
    reason: params.reason,
    search: params.search,
    date_from: params.date_from,
    date_to: params.date_to,
    reported_user: params.reported_user,
    min_reports: params.min_reports,
    page: params.page,
    limit: params.limit,
    include_stats: params.include_stats,
  })
}

export async function getAdminChatReportGroup(
  threadId: string
): Promise<ChatUserReportGroupDetail> {
  return apiClient.get<ChatUserReportGroupDetail>(`/api/admin/chat-reports/${threadId}`)
}

export async function applyAdminChatReportAction(
  threadId: string,
  input: {
    action: ChatUserReportActionType
    notes?: string
  }
): Promise<ChatUserReportGroupDetail> {
  return apiClient.post<ChatUserReportGroupDetail>(
    `/api/admin/chat-reports/${threadId}/actions`,
    input
  )
}
