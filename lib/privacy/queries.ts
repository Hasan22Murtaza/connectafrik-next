import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase-server'
import {
  normalizePrivacySettings,
  PRIVACY_SETTINGS_SELECT,
  type BlockState,
  type PrivacySettings,
  type UserRelationship,
} from './types'

function serviceDb(client?: SupabaseClient): SupabaseClient {
  try {
    return createServiceClient()
  } catch {
    if (client) return client
    throw new Error('Privacy checks require a Supabase client')
  }
}

function emptyBlock(): BlockState {
  return { blockedByMe: false, blockedByOther: false, isBlocked: false }
}

export async function loadPrivacySettings(
  targetIds: string[],
  client?: SupabaseClient
): Promise<Map<string, PrivacySettings>> {
  const result = new Map<string, PrivacySettings>()
  const unique = [...new Set(targetIds.filter(Boolean))]
  if (unique.length === 0) return result

  const db = serviceDb(client)
  const { data, error } = await db.from('profiles').select(PRIVACY_SETTINGS_SELECT).in('id', unique)
  if (error) {
    const fallback = await db.from('profiles').select('id, profile_visibility, post_visibility, allow_comments, allow_follows, allow_direct_messages, show_online_status, show_last_seen, show_location, show_phone, show_email, show_followers, show_following, show_country, show_followers_count, is_record, is_capture').in('id', unique)
    for (const row of fallback.data || []) {
      result.set(row.id, normalizePrivacySettings(row))
    }
    return result
  }

  for (const row of data || []) {
    result.set(row.id, normalizePrivacySettings(row))
  }
  return result
}

export async function loadFriendMaps(
  viewerId: string,
  targetIds: string[],
  client?: SupabaseClient
): Promise<{ accepted: Set<string>; blocked: Set<string> }> {
  const accepted = new Set<string>()
  const blocked = new Set<string>()
  const unique = [...new Set(targetIds.filter((id) => id && id !== viewerId))]
  if (!viewerId || unique.length === 0) return { accepted, blocked }

  const db = serviceDb(client)
  const { data } = await db
    .from('friend_requests')
    .select('sender_id, receiver_id, status')
    .or(`sender_id.eq.${viewerId},receiver_id.eq.${viewerId}`)
    .in('status', ['accepted', 'blocked'])

  for (const row of data || []) {
    const otherId = row.sender_id === viewerId ? row.receiver_id : row.sender_id
    if (!unique.includes(otherId)) continue
    if (row.status === 'accepted') accepted.add(otherId)
    if (row.status === 'blocked') blocked.add(otherId)
  }
  return { accepted, blocked }
}

export async function loadMutualFollowSet(
  viewerId: string,
  targetIds: string[],
  client?: SupabaseClient
): Promise<Set<string>> {
  const mutual = new Set<string>()
  const unique = [...new Set(targetIds.filter((id) => id && id !== viewerId))]
  if (!viewerId || unique.length === 0) return mutual

  const db = serviceDb(client)
  const [{ data: outgoing }, { data: incoming }] = await Promise.all([
    db.from('follows').select('following_id').eq('follower_id', viewerId).in('following_id', unique),
    db.from('follows').select('follower_id').eq('following_id', viewerId).in('follower_id', unique),
  ])

  const following = new Set((outgoing || []).map((r: { following_id: string }) => r.following_id))
  for (const row of incoming || []) {
    if (following.has(row.follower_id)) mutual.add(row.follower_id)
  }
  return mutual
}

/**
 * Global block is derived from direct-chat `chat_participants.is_block`
 * (the existing blocked-contacts UI) plus `friend_requests.status = blocked`.
 */
export async function loadBlockMap(
  viewerId: string,
  targetIds: string[],
  client?: SupabaseClient
): Promise<Map<string, BlockState>> {
  const result = new Map<string, BlockState>()
  const unique = [...new Set(targetIds.filter((id) => id && id !== viewerId))]
  for (const id of unique) result.set(id, emptyBlock())
  if (!viewerId || unique.length === 0) return result

  const db = serviceDb(client)
  const targetSet = new Set(unique)

  const { data: myParts } = await db
    .from('chat_participants')
    .select('thread_id')
    .eq('user_id', viewerId)

  const myThreadIds = [...new Set((myParts || []).map((p: { thread_id: string }) => p.thread_id))]
  if (myThreadIds.length > 0) {
    const { data: threads } = await db
      .from('chat_threads')
      .select('id')
      .eq('type', 'direct')
      .in('id', myThreadIds)

    const directIds = (threads || []).map((t: { id: string }) => t.id)
    if (directIds.length > 0) {
      const { data: parts } = await db
        .from('chat_participants')
        .select('thread_id, user_id, is_block')
        .in('thread_id', directIds)

      const byThread = new Map<string, Array<{ user_id: string; is_block: boolean }>>()
      for (const row of parts || []) {
        const list = byThread.get(row.thread_id) ?? []
        list.push({ user_id: row.user_id, is_block: Boolean(row.is_block) })
        byThread.set(row.thread_id, list)
      }

      for (const participants of byThread.values()) {
        const other = participants.find((p) => p.user_id !== viewerId)
        const me = participants.find((p) => p.user_id === viewerId)
        if (!other || !targetSet.has(other.user_id)) continue
        const current = result.get(other.user_id) ?? emptyBlock()
        if (me?.is_block) current.blockedByMe = true
        if (other.is_block) current.blockedByOther = true
        current.isBlocked = current.blockedByMe || current.blockedByOther
        result.set(other.user_id, current)
      }
    }
  }

  const { blocked } = await loadFriendMaps(viewerId, unique, db)
  for (const otherId of blocked) {
    const current = result.get(otherId) ?? emptyBlock()
    current.isBlocked = true
    result.set(otherId, current)
  }

  return result
}

export async function getRelationships(
  viewerId: string | null,
  targetIds: string[],
  client?: SupabaseClient
): Promise<Map<string, UserRelationship>> {
  const unique = [...new Set(targetIds.filter(Boolean))]
  const result = new Map<string, UserRelationship>()
  if (unique.length === 0) return result

  const settingsMap = await loadPrivacySettings(unique, client)
  const defaults = normalizePrivacySettings(null)

  if (!viewerId) {
    for (const id of unique) {
      result.set(id, {
        targetId: id,
        isSelf: false,
        isFriend: false,
        isMutualFollow: false,
        hasAcceptedFriendRequest: false,
        blockedByMe: false,
        blockedByOther: false,
        isBlocked: false,
        settings: settingsMap.get(id) ?? defaults,
      })
    }
    return result
  }

  const others = unique.filter((id) => id !== viewerId)
  const [friendMaps, mutualFollows, blocks] = await Promise.all([
    loadFriendMaps(viewerId, others, client),
    loadMutualFollowSet(viewerId, others, client),
    loadBlockMap(viewerId, others, client),
  ])

  for (const id of unique) {
    const isSelf = id === viewerId
    const block = blocks.get(id) ?? emptyBlock()
    const hasAcceptedFriendRequest = friendMaps.accepted.has(id)
    const isMutualFollow = mutualFollows.has(id)
    result.set(id, {
      targetId: id,
      isSelf,
      isFriend: isSelf || hasAcceptedFriendRequest || isMutualFollow,
      isMutualFollow: isSelf || isMutualFollow,
      hasAcceptedFriendRequest: isSelf || hasAcceptedFriendRequest,
      blockedByMe: block.blockedByMe,
      blockedByOther: block.blockedByOther,
      isBlocked: block.isBlocked,
      settings: settingsMap.get(id) ?? defaults,
    })
  }

  return result
}

export async function getRelationship(
  viewerId: string | null,
  targetId: string,
  client?: SupabaseClient
): Promise<UserRelationship> {
  const map = await getRelationships(viewerId, [targetId], client)
  const found = map.get(targetId)
  if (found) return found
  return {
    targetId,
    isSelf: viewerId === targetId,
    isFriend: viewerId === targetId,
    isMutualFollow: viewerId === targetId,
    hasAcceptedFriendRequest: viewerId === targetId,
    blockedByMe: false,
    blockedByOther: false,
    isBlocked: false,
    settings: normalizePrivacySettings(null),
  }
}
