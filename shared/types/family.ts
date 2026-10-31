export type FamilyStatus = 'active' | 'archived'
export type FamilyMemberRole = 'parent' | 'child' | 'teen'
export type FamilyMemberStatus = 'pending' | 'active' | 'suspended' | 'removed'
export type FamilyInvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled'
export type ContentFilterLevel = 'off' | 'low' | 'medium' | 'high'
export type SafetyAlertType =
  | 'suspicious_contact'
  | 'reported_content'
  | 'bullying'
  | 'harassment'
  | 'sexual_content'
  | 'self_harm_risk'
  | 'dangerous_content'
  | 'multiple_reports'
  | 'account_compromise'
  | 'suspicious_link'
  | 'excessive_usage'
export type SafetyAlertSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'
export type SafetyAlertStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed'
export type ActivityEventType =
  | 'session_ping'
  | 'post_view'
  | 'reel_view'
  | 'message_sent'
  | 'call'
  | 'friend_request_sent'
  | 'friend_request_received'
  | 'friend_added'
  | 'group_joined'
  | 'report'
  | 'safety_alert'
  | 'marketplace_view'

export interface Family {
  id: string
  name: string
  created_by: string
  status: FamilyStatus
  created_at: string
  updated_at: string
}

export interface FamilyMember {
  id: string
  family_id: string
  user_id: string
  role: FamilyMemberRole
  relationship: string | null
  status: FamilyMemberStatus
  joined_at: string | null
  created_at: string
  updated_at: string
  profile?: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
}

export interface FamilyInvitation {
  id: string
  family_id: string
  invited_by: string
  invitee_user_id: string | null
  invitee_email: string | null
  role: FamilyMemberRole
  status: FamilyInvitationStatus
  expires_at: string
  created_at: string
}

export interface ParentalControls {
  id: string
  family_member_id: string
  friend_request_approval: boolean
  messaging_enabled: boolean
  calling_enabled: boolean
  group_joining_enabled: boolean
  marketplace_enabled: boolean
  screen_time_enabled: boolean
  content_filter_level: ContentFilterLevel | null
  profile_visibility: string | null
  location_sharing: boolean | null
  created_at: string
  updated_at: string
}

export interface ScreenTimeRules {
  id: string
  family_member_id: string
  enabled: boolean
  daily_limit_minutes: number | null
  allowed_start_time: string | null
  allowed_end_time: string | null
  bedtime_start: string | null
  bedtime_end: string | null
  per_day_config: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface SafetyAlert {
  id: string
  family_member_id: string
  alert_type: SafetyAlertType
  severity: SafetyAlertSeverity
  title: string
  description: string | null
  source: string | null
  related_user_id: string | null
  related_content_id: string | null
  status: SafetyAlertStatus
  created_at: string
  resolved_at: string | null
}

export interface ActivitySummary {
  family_member_id: string
  period_start: string
  period_end: string
  session_minutes: number
  posts_viewed: number
  reels_watched: number
  messages_sent: number
  calls: number
  friends_added: number
  friend_requests: number
  groups_joined: number
  reports: number
  safety_alerts: number
}

/** One calendar day of CribsTalk session usage (1 session_ping ≈ 1 minute). */
export interface DailyScreenTimeUsage {
  /** YYYY-MM-DD (UTC) */
  date: string
  minutes: number
}

export interface ScreenTimeDailyHistory {
  days: number
  period_start: string
  period_end: string
  total_minutes: number
  average_minutes: number
  daily: DailyScreenTimeUsage[]
}

export type ParentalRestrictionFeature =
  | 'messaging'
  | 'calling'
  | 'group_joining'
  | 'marketplace'
  | 'friend_request_accept'
  | 'screen_time'

export const PARENTAL_RESTRICTED_CODE = 'PARENTAL_RESTRICTED'

export const DEFAULT_PARENTAL_CONTROLS: Omit<
  ParentalControls,
  'id' | 'family_member_id' | 'created_at' | 'updated_at'
> = {
  friend_request_approval: false,
  messaging_enabled: true,
  calling_enabled: true,
  group_joining_enabled: true,
  marketplace_enabled: true,
  screen_time_enabled: false,
  content_filter_level: null,
  profile_visibility: null,
  location_sharing: null,
}
