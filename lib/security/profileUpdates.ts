/**
 * Strict allowlist for self-service profile PATCH.
 * Privileged columns (platform_role, id, etc.) must never be client-writable.
 */

export const PROFILE_SELF_UPDATE_ALLOWLIST = [
  'username',
  'full_name',
  'first_name',
  'last_name',
  'avatar_url',
  'banner_image',
  'country',
  'address',
  'city',
  'state',
  'zipcode',
  'bio',
  'birthday',
  'gender',
  'phone_number',
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
  'email_notifications',
  'push_notifications',
  'comment_notifications',
  'like_notifications',
  'follow_notifications',
  'message_notifications',
  'mention_notifications',
  'post_updates',
  'login_alerts',
  'message_translation_language',
  'data_download_requested',
] as const

export type ProfileSelfUpdateField = (typeof PROFILE_SELF_UPDATE_ALLOWLIST)[number]

const ALLOWLIST_SET = new Set<string>(PROFILE_SELF_UPDATE_ALLOWLIST)

/** Columns that must never be accepted from client profile updates. */
export const PROFILE_FORBIDDEN_UPDATE_FIELDS = [
  'id',
  'created_at',
  'platform_role',
  'two_factor_enabled',
  'email',
  'location',
  'region',
] as const

/**
 * Filter a raw PATCH body to only allowlisted profile fields.
 * Returns null if no allowlisted fields remain.
 */
export function pickAllowedProfileUpdates(
  raw: Record<string, unknown>
): Record<string, unknown> | null {
  const updates: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (ALLOWLIST_SET.has(key)) {
      updates[key] = value
    }
  }
  return Object.keys(updates).length > 0 ? updates : null
}

export function containsForbiddenProfileField(raw: Record<string, unknown>): string | null {
  for (const key of Object.keys(raw)) {
    if ((PROFILE_FORBIDDEN_UPDATE_FIELDS as readonly string[]).includes(key)) {
      return key
    }
  }
  return null
}
