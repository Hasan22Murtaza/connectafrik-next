import {
  canViewLastSeen,
  canViewOnlineStatus,
  canViewProfile,
  canViewReadReceipt,
  getVisibleProfileFields,
} from '@/shared/utils/visibilityUtils'
import type { UserRelationship, ViewerPermissions } from './types'
import { permissionsFromRelationship } from './access'

const OWNER_ONLY_KEYS = new Set([
  'email',
  'phone_number',
  'two_factor_enabled',
  'login_alerts',
  'data_download_requested',
  'email_notifications',
  'push_notifications',
  'comment_notifications',
  'like_notifications',
  'follow_notifications',
  'message_notifications',
  'mention_notifications',
  'post_updates',
  'weekly_digest',
  'message_translation_language',
  'bank_account_name',
  'bank_account_number',
  'bank_name',
  'bank_routing_number',
  'payout_details',
])

export function restrictedProfileStub(profile: Record<string, unknown>): Record<string, unknown> {
  return {
    id: profile.id,
    username: profile.username ?? null,
    full_name: profile.full_name ?? null,
    avatar_url: profile.avatar_url ?? null,
    is_verified: profile.is_verified ?? false,
    profile_restricted: true,
  }
}

export function sanitizeProfileForViewer(
  profile: Record<string, unknown>,
  viewerId: string | null,
  rel: UserRelationship
): Record<string, unknown> {
  const ownerId = String(profile.id || rel.targetId)
  const permissions = permissionsFromRelationship(viewerId, rel)

  if (rel.isSelf) {
    return {
      ...profile,
      profile_restricted: false,
      permissions,
    }
  }

  if (!canViewProfile(viewerId, ownerId, rel.settings.profile_visibility, rel.isFriend, rel.isBlocked)) {
    return {
      ...restrictedProfileStub(profile),
      permissions: {
        ...permissions,
        can_view: false,
      },
    }
  }

  const fields = getVisibleProfileFields(rel.settings, false, rel.isFriend, rel.isBlocked)
  const next: Record<string, unknown> = { ...profile, profile_restricted: false, permissions }

  for (const key of OWNER_ONLY_KEYS) {
    if (key === 'email' && fields.email) continue
    if (key === 'phone_number' && fields.phone) continue
    delete next[key]
  }

  if (!fields.email) {
    delete next.email
  }
  if (!fields.phone) {
    delete next.phone_number
  }
  if (!fields.country) {
    delete next.country
  }
  if (!fields.location) {
    delete next.address
    delete next.city
    delete next.state
    delete next.zipcode
    delete next.location
  }
  if (!fields.followersCount) {
    next.followers_count = 0
    next.follower_count = 0
  }
  if (!canViewOnlineStatus(viewerId, ownerId, rel.settings.show_online_status, rel.isBlocked)) {
    next.status = null
  }
  if (!canViewLastSeen(viewerId, ownerId, rel.settings.show_last_seen, rel.isBlocked)) {
    next.last_seen = null
    next.last_active_at = null
  }

  return next
}

export function sanitizePresenceFields(
  profile: { id?: string; status?: unknown; last_seen?: unknown; last_active_at?: unknown },
  viewerId: string | null,
  rel: UserRelationship
): { status: unknown; last_seen: unknown; last_active_at?: unknown } {
  const ownerId = String(profile.id || rel.targetId)
  return {
    status: canViewOnlineStatus(viewerId, ownerId, rel.settings.show_online_status, rel.isBlocked)
      ? profile.status ?? null
      : null,
    last_seen: canViewLastSeen(viewerId, ownerId, rel.settings.show_last_seen, rel.isBlocked)
      ? profile.last_seen ?? null
      : null,
    last_active_at: canViewLastSeen(viewerId, ownerId, rel.settings.show_last_seen, rel.isBlocked)
      ? profile.last_active_at ?? null
      : null,
  }
}

export function filterReadByForViewer(
  readBy: string[],
  viewerId: string | null,
  relationships: Map<string, UserRelationship>
): string[] {
  if (!Array.isArray(readBy) || readBy.length === 0) return []
  return readBy.filter((readerId) => {
    if (viewerId && readerId === viewerId) return true
    const rel = relationships.get(readerId)
    if (!rel) return true
    return canViewReadReceipt(viewerId, readerId, rel.settings.show_read_receipts, rel.isBlocked)
  })
}

export function viewerPermissions(viewerId: string | null, rel: UserRelationship): ViewerPermissions {
  return permissionsFromRelationship(viewerId, rel)
}
