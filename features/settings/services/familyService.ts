import { apiClient } from '@/lib/api-client'
import type {
  ActivitySummary,
  Family,
  FamilyInvitation,
  FamilyMember,
  FamilyMemberRole,
  ParentalControls,
  SafetyAlert,
  ScreenTimeDailyHistory,
  ScreenTimeRules,
} from '@/shared/types/family'

export type FamilyOverview = {
  family: Family | null
  membership: FamilyMember | null
  members: FamilyMember[]
}

export type FamilyMeStatus = {
  has_family: boolean
  role: FamilyMemberRole | null
  controls_active: boolean
  membership?: FamilyMember | null
  controls: ParentalControls | null
  screen_time: {
    rules: ScreenTimeRules
    used_minutes_today: number
    evaluation: {
      allowed: boolean
      reason?: string
      message?: string
      usedMinutes?: number
      dailyLimitMinutes?: number | null
    }
  } | null
}

export type FamilyUsagePingResult = {
  recorded: boolean
  used_minutes_today?: number
  evaluation?: {
    allowed: boolean
    reason?: string
    message?: string
    usedMinutes?: number
    dailyLimitMinutes?: number | null
  }
}

export const familyService = {
  getOverview: () => apiClient.get<FamilyOverview>('/api/family'),

  createFamily: (name: string) =>
    apiClient.post<{ family: Family; membership: FamilyMember }>('/api/family', { name }),

  getMe: () => apiClient.get<FamilyMeStatus>('/api/family/me'),

  pingUsage: () =>
    apiClient.post<FamilyUsagePingResult>('/api/family/me', { action: 'session_ping' }),

  listIncomingInvitations: () =>
    apiClient.get<FamilyInvitation[]>('/api/family/invitations', { scope: 'incoming' }),

  listOutgoingInvitations: () =>
    apiClient.get<FamilyInvitation[]>('/api/family/invitations', { scope: 'outgoing' }),

  invite: (payload: {
    family_id: string
    role: FamilyMemberRole
    invitee_user_id?: string
    invitee_email?: string
  }) =>
    apiClient.post<FamilyInvitation & { token?: string; invitee_user_id?: string | null }>(
      '/api/family/invitations',
      payload
    ),

  acceptInvitation: (id: string, token?: string) =>
    apiClient.post<{ membership: FamilyMember }>(`/api/family/invitations/${id}/accept`, {
      token,
    }),

  rejectInvitation: (id: string, token?: string) =>
    apiClient.post<FamilyInvitation>(`/api/family/invitations/${id}/reject`, { token }),

  cancelInvitation: (id: string) =>
    apiClient.patch<FamilyInvitation>('/api/family/invitations', { id }),

  removeMember: (familyId: string, memberId: string) =>
    apiClient.delete<FamilyMember>(`/api/family/${familyId}/members`, {
      member_id: memberId,
    }),

  getControls: (memberId: string) =>
    apiClient.get<ParentalControls | null>(`/api/family/members/${memberId}/controls`),

  updateControls: (memberId: string, updates: Partial<ParentalControls>) =>
    apiClient.patch<ParentalControls>(`/api/family/members/${memberId}/controls`, updates),

  getScreenTime: (memberId: string, days = 7) =>
    apiClient.get<{
      rules: ScreenTimeRules
      used_minutes_today: number
      evaluation: { allowed: boolean; message?: string }
      history: ScreenTimeDailyHistory
    } | null>(`/api/family/members/${memberId}/screen-time`, { days }),

  updateScreenTime: (memberId: string, updates: Partial<ScreenTimeRules>) =>
    apiClient.patch<ScreenTimeRules>(`/api/family/members/${memberId}/screen-time`, updates),

  getActivity: (memberId: string, days = 7) =>
    apiClient.get<ActivitySummary>(`/api/family/members/${memberId}/activity`, { days }),

  listAlerts: (params?: { status?: string; member_id?: string }) =>
    apiClient.get<SafetyAlert[]>('/api/family/alerts', params),

  updateAlert: (id: string, status: string) =>
    apiClient.patch<SafetyAlert>(`/api/family/alerts/${id}`, { status }),

  listPendingFriendRequests: (memberId: string) =>
    apiClient.get<
      Array<{
        id: string
        sender_id: string
        status: string
        created_at: string
        sender: { id: string; username: string | null; full_name: string | null; avatar_url: string | null } | null
      }>
    >(`/api/family/members/${memberId}/friend-requests`),

  approveFriendRequest: (memberId: string, requestId: string) =>
    apiClient.post(`/api/family/members/${memberId}/friend-requests/${requestId}/approve`, {}),
}
