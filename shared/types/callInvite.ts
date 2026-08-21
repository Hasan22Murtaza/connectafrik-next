export type CallInviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired'

export interface CallInvitation {
  user_id: string
  thread_id: string
  session_id: string
  status: CallInviteStatus
  invited_at: string
  full_name?: string | null
  username?: string | null
  avatar_url?: string | null
  presence_status?: string | null
}

export interface CallHistoryParticipant {
  id: string
  name: string
  avatar_url?: string | null
}
