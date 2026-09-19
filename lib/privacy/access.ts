import type { SupabaseClient } from '@supabase/supabase-js'
import {
  canCall as canCallRule,
  canComment as canCommentRule,
  canFollow as canFollowRule,
  canSendFriendRequest as canSendFriendRequestRule,
  canSendMessage as canSendMessageRule,
  canViewLastSeen as canViewLastSeenRule,
  canViewOnlineStatus as canViewOnlineStatusRule,
  canViewPost as canViewPostRule,
  canViewProfile as canViewProfileRule,
  canViewReadReceipt as canViewReadReceiptRule,
  PRIVACY_DENIED_CODE,
  PRIVACY_ERRORS,
} from '@/shared/utils/visibilityUtils'
import { getRelationship, getRelationships } from './queries'
import type { PrivacyDecision, UserRelationship, ViewerPermissions } from './types'

export type { UserRelationship, ViewerPermissions, PrivacyDecision }

function deny(message: string): PrivacyDecision {
  return { allowed: false, code: PRIVACY_DENIED_CODE, message }
}

export function permissionsFromRelationship(
  viewerId: string | null,
  rel: UserRelationship
): ViewerPermissions {
  const friend = rel.isFriend
  const blocked = rel.isBlocked
  return {
    can_view: canViewProfileRule(viewerId, rel.targetId, rel.settings.profile_visibility, friend, blocked),
    can_follow: canFollowRule(viewerId, rel.targetId, rel.settings.allow_follows, friend, blocked),
    can_friend_request: canSendFriendRequestRule(viewerId, rel.targetId, rel.settings.allow_follows, friend, blocked),
    can_message: canSendMessageRule(viewerId, rel.targetId, rel.settings.allow_direct_messages, friend, blocked),
    can_call: canCallRule(viewerId, rel.targetId, friend, blocked, false),
    can_view_online_status: canViewOnlineStatusRule(viewerId, rel.targetId, rel.settings.show_online_status, blocked),
    can_view_last_seen: canViewLastSeenRule(viewerId, rel.targetId, rel.settings.show_last_seen, blocked),
    can_view_followers: rel.isSelf || (!blocked && rel.settings.show_followers),
    can_view_following: rel.isSelf || (!blocked && rel.settings.show_following),
    is_blocked: blocked,
    is_friend: friend,
  }
}

export async function isBlocked(
  userA: string | null,
  userB: string,
  client?: SupabaseClient
): Promise<boolean> {
  if (!userA || userA === userB) return false
  const rel = await getRelationship(userA, userB, client)
  return rel.isBlocked
}

export async function canViewProfile(
  viewerId: string | null,
  targetUserId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const rel = await getRelationship(viewerId, targetUserId, client)
  return canViewProfileRule(viewerId, targetUserId, rel.settings.profile_visibility, rel.isFriend, rel.isBlocked)
}

export async function canViewPost(
  viewerId: string | null,
  postId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const access = await loadPostAuthorAccess(viewerId, postId, client)
  return access.allowed
}

export async function canSendFriendRequest(
  viewerId: string | null,
  targetUserId: string,
  client?: SupabaseClient
): Promise<PrivacyDecision> {
  if (!viewerId) return deny(PRIVACY_ERRORS.friendRequest)
  if (viewerId === targetUserId) return deny('Cannot send friend request to yourself')
  const rel = await getRelationship(viewerId, targetUserId, client)
  if (rel.isBlocked) return deny(PRIVACY_ERRORS.blocked)
  if (!canSendFriendRequestRule(viewerId, targetUserId, rel.settings.allow_follows, rel.isFriend, rel.isBlocked)) {
    return deny(PRIVACY_ERRORS.friendRequest)
  }
  return { allowed: true }
}

export async function canFollowUser(
  viewerId: string | null,
  targetUserId: string,
  client?: SupabaseClient
): Promise<PrivacyDecision> {
  if (!viewerId) return deny(PRIVACY_ERRORS.follow)
  const rel = await getRelationship(viewerId, targetUserId, client)
  if (rel.isBlocked) return deny(PRIVACY_ERRORS.blocked)
  if (!canFollowRule(viewerId, targetUserId, rel.settings.allow_follows, rel.isFriend, rel.isBlocked)) {
    return deny(PRIVACY_ERRORS.follow)
  }
  return { allowed: true }
}

export async function canMessage(
  viewerId: string | null,
  targetUserId: string,
  client?: SupabaseClient
): Promise<PrivacyDecision> {
  if (!viewerId) return deny(PRIVACY_ERRORS.message)
  if (viewerId === targetUserId) return { allowed: true }
  const rel = await getRelationship(viewerId, targetUserId, client)
  if (rel.isBlocked) return deny(PRIVACY_ERRORS.blocked)
  if (!canSendMessageRule(viewerId, targetUserId, rel.settings.allow_direct_messages, rel.isFriend, rel.isBlocked)) {
    return deny(PRIVACY_ERRORS.message)
  }
  return { allowed: true }
}

export async function canCall(
  viewerId: string | null,
  targetUserId: string,
  options?: { isGroupCall?: boolean; client?: SupabaseClient }
): Promise<PrivacyDecision> {
  if (!viewerId) return deny(PRIVACY_ERRORS.call)
  if (viewerId === targetUserId) return deny(PRIVACY_ERRORS.call)
  const rel = await getRelationship(viewerId, targetUserId, options?.client)
  if (rel.isBlocked) return deny(PRIVACY_ERRORS.blocked)
  if (!canCallRule(viewerId, targetUserId, rel.isFriend, rel.isBlocked, options?.isGroupCall === true)) {
    return deny(PRIVACY_ERRORS.call)
  }
  return { allowed: true }
}

export async function canViewOnlineStatus(
  viewerId: string | null,
  targetUserId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const rel = await getRelationship(viewerId, targetUserId, client)
  return canViewOnlineStatusRule(viewerId, targetUserId, rel.settings.show_online_status, rel.isBlocked)
}

export async function canViewReadReceipt(
  viewerId: string | null,
  readerId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const rel = await getRelationship(viewerId, readerId, client)
  return canViewReadReceiptRule(viewerId, readerId, rel.settings.show_read_receipts, rel.isBlocked)
}

export async function canCommentOnAuthor(
  viewerId: string | null,
  authorId: string,
  client?: SupabaseClient
): Promise<PrivacyDecision> {
  if (!viewerId) return deny(PRIVACY_ERRORS.comment)
  const rel = await getRelationship(viewerId, authorId, client)
  if (rel.isBlocked) return deny(PRIVACY_ERRORS.blocked)
  if (!canViewPostRule(viewerId, authorId, rel.settings.post_visibility, rel.isFriend, rel.isBlocked)) {
    return deny(PRIVACY_ERRORS.postUnavailable)
  }
  if (!canCommentRule(viewerId, authorId, rel.settings.allow_comments, rel.isFriend, rel.isBlocked)) {
    return deny(PRIVACY_ERRORS.comment)
  }
  return { allowed: true }
}

export async function loadPostAuthorAccess(
  viewerId: string | null,
  postId: string,
  client?: SupabaseClient
): Promise<PrivacyDecision & { authorId?: string }> {
  const { createServiceClient } = await import('@/lib/supabase-server')
  let db: SupabaseClient
  try {
    db = createServiceClient()
  } catch {
    if (!client) return deny(PRIVACY_ERRORS.postUnavailable)
    db = client
  }

  const { data: post } = await db
    .from('posts')
    .select('id, author_id, is_deleted')
    .eq('id', postId)
    .maybeSingle()

  if (!post || post.is_deleted) return deny(PRIVACY_ERRORS.postUnavailable)

  const rel = await getRelationship(viewerId, post.author_id, db)
  if (!canViewPostRule(viewerId, post.author_id, rel.settings.post_visibility, rel.isFriend, rel.isBlocked)) {
    return deny(PRIVACY_ERRORS.postUnavailable)
  }
  return { allowed: true, authorId: post.author_id }
}

export async function filterVisibleUserIds(
  viewerId: string | null,
  targetIds: string[],
  client?: SupabaseClient
): Promise<Set<string>> {
  const rels = await getRelationships(viewerId, targetIds, client)
  const visible = new Set<string>()
  for (const id of targetIds) {
    const rel = rels.get(id)
    if (!rel) continue
    if (canViewProfileRule(viewerId, id, rel.settings.profile_visibility, rel.isFriend, rel.isBlocked)) {
      visible.add(id)
    }
  }
  return visible
}

export async function filterSearchableUserIds(
  viewerId: string | null,
  targetIds: string[],
  client?: SupabaseClient
): Promise<Set<string>> {
  return filterVisibleUserIds(viewerId, targetIds, client)
}

export { getRelationship, getRelationships }
