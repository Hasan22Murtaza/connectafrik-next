import type { Profile, ProfileVisibilityLevel } from '@/shared/types'

/** Whether viewer can see the profile (profile_visibility: public | friends | private) */
export function canViewProfile(
  viewerId: string | null,
  ownerId: string,
  profileVisibility: ProfileVisibilityLevel = 'public',
  isMutual: boolean
): boolean {
  if (viewerId === ownerId) return true
  if (profileVisibility === 'public' || profileVisibility === 'everyone') return true
  if (profileVisibility === 'private') return false
  if (profileVisibility === 'friends') return isMutual
  return false
}

/**
 * Whether viewer can see a post (post_visibility: public | friends | private).
 * - public/everyone: everyone can see
 * - friends: only mutual follow (both follow each other) can see
 * - private: only the author can see
 */
export function canViewPost(
  viewerId: string | null,
  authorId: string,
  postVisibility: ProfileVisibilityLevel = 'public',
  isMutual: boolean
): boolean {
  if (viewerId === authorId) return true
  if (postVisibility === 'public' || postVisibility === 'everyone') return true
  if (postVisibility === 'private') return false
  if (postVisibility === 'friends') return isMutual // show only to Friends (mutual follow)
  return false
}

/** Whether viewer can comment (allow_comments: everyone | friends | none) */
export function canComment(
  viewerId: string | null,
  authorId: string,
  allowComments: ProfileVisibilityLevel = 'everyone',
  isMutual: boolean
): boolean {
  if (!viewerId) return false
  if (viewerId === authorId) return true
  if (allowComments === 'none') return false
  if (allowComments === 'everyone' || allowComments === 'public') return true
  if (allowComments === 'friends') return isMutual
  return false
}

/** Whether viewer can follow this profile (allow_follows: everyone | friends | none) */
export function canFollow(
  viewerId: string | null,
  ownerId: string,
  allowFollows: ProfileVisibilityLevel = 'everyone',
  isMutual: boolean
): boolean {
  if (!viewerId || viewerId === ownerId) return false
  if (allowFollows === 'none') return false
  if (allowFollows === 'everyone' || allowFollows === 'public') return true
  if (allowFollows === 'friends') return isMutual
  return false
}

/** Whether viewer can send direct messages (allow_direct_messages: everyone | friends | none) */
export function canSendMessage(
  viewerId: string | null,
  ownerId: string,
  allowDirectMessages: ProfileVisibilityLevel = 'everyone',
  isMutual: boolean
): boolean {
  if (!viewerId || viewerId === ownerId) return false
  if (allowDirectMessages === 'none') return false
  if (allowDirectMessages === 'everyone' || allowDirectMessages === 'public') return true
  if (allowDirectMessages === 'friends') return isMutual
  return false
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
  _isMutual: boolean
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
