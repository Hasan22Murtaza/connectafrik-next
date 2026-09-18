import type { Profile, ProfileVisibilityLevel } from '@/shared/types'

export const PRIVACY_DENIED_CODE = 'PRIVACY_DENIED'

export const PRIVACY_ERRORS = {
  blocked: 'You cannot interact with this user because of a block.',
  profileUnavailable: 'This profile is not available',
  postUnavailable: 'Post not found',
  friendRequest: "You can't send a friend request because of this user's privacy settings.",
  follow: "You can't follow this user because of their privacy settings.",
  message: "You can't message this user because of their privacy settings.",
  call: "You can't call this user because of their privacy settings.",
  comment: "You can't comment on this post because of the author's privacy settings.",
} as const

export const DEFAULT_PRIVACY_SETTINGS = {
  profile_visibility: 'public' as ProfileVisibilityLevel,
  post_visibility: 'public' as ProfileVisibilityLevel,
  allow_comments: 'everyone' as ProfileVisibilityLevel,
  allow_follows: 'everyone' as ProfileVisibilityLevel,
  allow_direct_messages: 'everyone' as ProfileVisibilityLevel,
  show_online_status: true,
  show_last_seen: true,
  show_location: true,
  show_phone: false,
  show_email: false,
  show_followers: true,
  show_following: true,
  show_country: true,
  show_followers_count: true,
  show_read_receipts: true,
  is_record: true,
  is_capture: true,
}

export function isOpenVisibility(level: ProfileVisibilityLevel | string | null | undefined): boolean {
  return level === 'public' || level === 'everyone' || !level
}

export function isFriendsVisibility(level: ProfileVisibilityLevel | string | null | undefined): boolean {
  return level === 'friends'
}

export function isClosedVisibility(level: ProfileVisibilityLevel | string | null | undefined): boolean {
  return level === 'private' || level === 'none'
}

function meetsLevel(
  viewerId: string | null,
  ownerId: string,
  level: ProfileVisibilityLevel | string | null | undefined,
  isFriend: boolean,
  options?: { allowOwner?: boolean; closedMeansNone?: boolean }
): boolean {
  if (options?.allowOwner !== false && viewerId === ownerId) return true
  if (isClosedVisibility(level)) return false
  if (isOpenVisibility(level)) return true
  if (isFriendsVisibility(level)) return Boolean(viewerId) && isFriend
  return false
}

/**
 * Whether viewer can see the profile (profile_visibility: public | friends | private).
 * Blocking is checked first when `isBlocked` is true.
 */
export function canViewProfile(
  viewerId: string | null,
  ownerId: string,
  profileVisibility: ProfileVisibilityLevel = 'public',
  isMutual: boolean,
  isBlocked = false
): boolean {
  if (isBlocked && viewerId !== ownerId) return false
  return meetsLevel(viewerId, ownerId, profileVisibility, isMutual)
}

/**
 * Whether viewer can see a post (post_visibility: public | friends | private).
 */
export function canViewPost(
  viewerId: string | null,
  authorId: string,
  postVisibility: ProfileVisibilityLevel = 'public',
  isMutual: boolean,
  isBlocked = false
): boolean {
  if (isBlocked && viewerId !== authorId) return false
  return meetsLevel(viewerId, authorId, postVisibility, isMutual)
}

/** Whether viewer can comment (allow_comments: everyone | friends | none) */
export function canComment(
  viewerId: string | null,
  authorId: string,
  allowComments: ProfileVisibilityLevel = 'everyone',
  isMutual: boolean,
  isBlocked = false
): boolean {
  if (!viewerId) return false
  if (isBlocked && viewerId !== authorId) return false
  if (viewerId === authorId) return true
  return meetsLevel(viewerId, authorId, allowComments, isMutual, { allowOwner: true })
}

/** Whether viewer can follow this profile (allow_follows: everyone | friends | none) */
export function canFollow(
  viewerId: string | null,
  ownerId: string,
  allowFollows: ProfileVisibilityLevel = 'everyone',
  isMutual: boolean,
  isBlocked = false
): boolean {
  if (!viewerId || viewerId === ownerId) return false
  if (isBlocked) return false
  return meetsLevel(viewerId, ownerId, allowFollows, isMutual, { allowOwner: false })
}

/** Whether viewer can send a new friend/follow request. */
export function canSendFriendRequest(
  viewerId: string | null,
  ownerId: string,
  allowFollows: ProfileVisibilityLevel = 'everyone',
  isMutual: boolean,
  isBlocked = false
): boolean {
  return canFollow(viewerId, ownerId, allowFollows, isMutual, isBlocked)
}

/** Whether viewer can send direct messages (allow_direct_messages: everyone | friends | none) */
export function canSendMessage(
  viewerId: string | null,
  ownerId: string,
  allowDirectMessages: ProfileVisibilityLevel = 'everyone',
  isMutual: boolean,
  isBlocked = false
): boolean {
  if (!viewerId || viewerId === ownerId) return false
  if (isBlocked) return false
  return meetsLevel(viewerId, ownerId, allowDirectMessages, isMutual, { allowOwner: false })
}

/**
 * Voice/video calls are friends-only (privacy UI is not configurable).
 * Group-call participation is allowed for thread members when not blocked.
 */
export function canCall(
  viewerId: string | null,
  ownerId: string,
  isFriend: boolean,
  isBlocked = false,
  isGroupCall = false
): boolean {
  if (!viewerId || viewerId === ownerId) return false
  if (isBlocked) return false
  if (isGroupCall) return true
  return isFriend
}

export function canViewOnlineStatus(
  viewerId: string | null,
  ownerId: string,
  showOnlineStatus = true,
  isBlocked = false
): boolean {
  if (viewerId === ownerId) return true
  if (isBlocked) return false
  return showOnlineStatus
}

export function canViewLastSeen(
  viewerId: string | null,
  ownerId: string,
  showLastSeen = true,
  isBlocked = false
): boolean {
  if (viewerId === ownerId) return true
  if (isBlocked) return false
  return showLastSeen
}

/**
 * Whether the viewer may see that `readerId` read a message.
 * The reader’s `show_read_receipts` setting controls disclosure to others.
 */
export function canViewReadReceipt(
  viewerId: string | null,
  readerId: string,
  showReadReceipts = true,
  isBlocked = false
): boolean {
  if (!viewerId) return false
  if (viewerId === readerId) return true
  if (isBlocked) return false
  return showReadReceipts
}

export interface VisibleProfileFields {
  country: boolean
  phone: boolean
  email: boolean
  followersCount: boolean
  followingCount: boolean
  followersList: boolean
  followingList: boolean
  lastSeen: boolean
  onlineStatus: boolean
  location: boolean
}

/** Shape needed for visibility field checks (avoids Profile's strict optional types like avatar_url) */
export type VisibleProfileFieldsInput = Partial<Pick<Profile,
  'show_country' | 'show_phone' | 'show_email' | 'show_followers' | 'show_following' |
  'show_followers_count' | 'show_last_seen' | 'show_online_status' | 'show_location'>>

/** Which profile fields to show based on show_* settings and relationship */
export function getVisibleProfileFields(
  profile: VisibleProfileFieldsInput,
  viewerIsOwner: boolean,
  _isMutual: boolean,
  isBlocked = false
): VisibleProfileFields {
  if (viewerIsOwner) {
    return {
      country: true,
      phone: true,
      email: true,
      followersCount: true,
      followingCount: true,
      followersList: true,
      followingList: true,
      lastSeen: true,
      onlineStatus: true,
      location: true,
    }
  }
  if (isBlocked) {
    return {
      country: false,
      phone: false,
      email: false,
      followersCount: false,
      followingCount: false,
      followersList: false,
      followingList: false,
      lastSeen: false,
      onlineStatus: false,
      location: false,
    }
  }
  return {
    country: profile.show_country ?? true,
    phone: profile.show_phone ?? false,
    email: profile.show_email ?? false,
    followersCount: profile.show_followers_count ?? true,
    followingCount: true,
    followersList: profile.show_followers ?? true,
    followingList: profile.show_following ?? true,
    lastSeen: profile.show_last_seen ?? true,
    onlineStatus: profile.show_online_status ?? true,
    location: profile.show_location ?? false,
  }
}
