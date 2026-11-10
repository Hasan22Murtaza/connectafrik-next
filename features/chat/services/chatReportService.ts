import { apiClient } from '@/lib/api-client'
import type {
  ChatReportedMessageSnapshot,
  PostReportReason,
} from '@/lib/reports/types'

export interface SubmitChatUserReportResult {
  submitted: boolean
}

export async function submitChatUserReport(input: {
  threadId: string
  reportedUserId: string
  reason: PostReportReason
  notes?: string
  messageSnapshot?: ChatReportedMessageSnapshot[]
}): Promise<SubmitChatUserReportResult> {
  return apiClient.post<SubmitChatUserReportResult>(
    `/api/chat/threads/${input.threadId}/report`,
    {
      reported_user_id: input.reportedUserId,
      reason: input.reason,
      notes: input.notes,
      message_snapshot: input.messageSnapshot,
    }
  )
}
