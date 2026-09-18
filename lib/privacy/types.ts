import type { ProfileVisibilityLevel } from '@/shared/types'
import { DEFAULT_PRIVACY_SETTINGS } from '@/shared/utils/visibilityUtils'

export type PrivacySettings = {
  profile_visibility: ProfileVisibilityLevel
  post_visibility: ProfileVisibilityLevel
  allow_comments: ProfileVisibilityLevel
  allow_follows: ProfileVisibilityLevel
  allow_direct_messages: ProfileVisibilityLevel
  show_online_status: boolean
  show_last_seen: boolean
  show_location: boolean
  show_phone: boolean
  show_email: boolean
  show_followers: boolean
  show_following: boolean
  show_country: boolean
  show_followers_count: boolean
  show_read_receipts: boolean
  is_record: boolean
  is_capture: boolean
}

export type BlockState = {
  blockedByMe: boolean
  blockedByOther: boolean
  isBlocked: boolean
}

export type UserRelationship = {
  targetId: string
  isSelf: boolean
  isFriend: boolean
  isMutualFollow: boolean
  hasAcceptedFriendRequest: boolean
  blockedByMe: boolean
  blockedByOther: boolean
  isBlocked: boolean
  settings: PrivacySettings
}

export type ViewerPermissions = {
  can_view: boolean
  can_follow: boolean
  can_friend_request: boolean
  can_message: boolean
  can_call: boolean
  can_view_online_status: boolean
  can_view_last_seen: boolean
  can_view_followers: boolean
  can_view_following: boolean
  is_blocked: boolean
  is_friend: boolean
}

export type PrivacyDecision = {
  allowed: boolean
  code?: string
  message?: string
}

export const PRIVACY_SETTINGS_SELECT = [
  'id',
  'profile_visibility',
  'post_visibility',
  'allow_comments',
  'allow_follows',
  'allow_direct_messages',
  'show_online_status',
  'show_last_seen',
  'show_location',
  'show_phone',
  'show_email',
  'show_followers',
  'show_following',
  'show_country',
  'show_followers_count',
  'show_read_receipts',
  'is_record',
  'is_capture',
].join(', ')

export function normalizePrivacySettings(
  row: Partial<PrivacySettings> | null | undefined
): PrivacySettings {
  return {
    profile_visibility: row?.profile_visibility || DEFAULT_PRIVACY_SETTINGS.profile_visibility,
    post_visibility: row?.post_visibility || DEFAULT_PRIVACY_SETTINGS.post_visibility,
    allow_comments: row?.allow_comments || DEFAULT_PRIVACY_SETTINGS.allow_comments,
    allow_follows: row?.allow_follows || DEFAULT_PRIVACY_SETTINGS.allow_follows,
    allow_direct_messages: row?.allow_direct_messages || DEFAULT_PRIVACY_SETTINGS.allow_direct_messages,
    show_online_status: row?.show_online_status ?? DEFAULT_PRIVACY_SETTINGS.show_online_status,
    show_last_seen: row?.show_last_seen ?? DEFAULT_PRIVACY_SETTINGS.show_last_seen,
    show_location: row?.show_location ?? DEFAULT_PRIVACY_SETTINGS.show_location,
    show_phone: row?.show_phone ?? DEFAULT_PRIVACY_SETTINGS.show_phone,
    show_email: row?.show_email ?? DEFAULT_PRIVACY_SETTINGS.show_email,
    show_followers: row?.show_followers ?? DEFAULT_PRIVACY_SETTINGS.show_followers,
    show_following: row?.show_following ?? DEFAULT_PRIVACY_SETTINGS.show_following,
    show_country: row?.show_country ?? DEFAULT_PRIVACY_SETTINGS.show_country,
    show_followers_count: row?.show_followers_count ?? DEFAULT_PRIVACY_SETTINGS.show_followers_count,
    show_read_receipts: row?.show_read_receipts ?? DEFAULT_PRIVACY_SETTINGS.show_read_receipts,
    is_record: row?.is_record ?? DEFAULT_PRIVACY_SETTINGS.is_record,
    is_capture: row?.is_capture ?? DEFAULT_PRIVACY_SETTINGS.is_capture,
  }
}

export const IDENTITY_PROFILE_FIELDS = [
  'id',
  'username',
  'full_name',
  'avatar_url',
  'is_verified',
] as const
