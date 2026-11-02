import type { SupabaseClient } from '@supabase/supabase-js'

export type ConnectionRow = {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
  banner_image: string | null
  country: string | null
}

export async function fetchConnectionsForOwner(
  supabase: SupabaseClient,
  ownerId: string
): Promise<ConnectionRow[]> {
  const friendsMap = new Map<string, unknown>()

  const { data: friendReqData } = await supabase
    .from('friend_requests')
    .select('sender_id, receiver_id')
    .or(`sender_id.eq.${ownerId},receiver_id.eq.${ownerId}`)
    .eq('status', 'accepted')

  const friendIds: string[] = []
  if (friendReqData) {
    friendReqData.forEach((r: { sender_id: string; receiver_id: string }) => {
      const fId = r.sender_id === ownerId ? r.receiver_id : r.sender_id
      if (!friendsMap.has(fId)) {
        friendsMap.set(fId, null)
        friendIds.push(fId)
      }
    })
  }

  // The Friends tab includes both accepted friends and mutual follows.
  // Mutual-friends-only filtering is handled by the dedicated mutual endpoint.
  const [{ data: followersData }, { data: followingData }] = await Promise.all([
    supabase.from('follows').select('follower_id').eq('following_id', ownerId),
    supabase.from('follows').select('following_id').eq('follower_id', ownerId),
  ])

  if (followersData && followingData) {
    const followerIds = new Set(followersData.map((row: { follower_id: string }) => row.follower_id))
    followingData
      .filter((row: { following_id: string }) => followerIds.has(row.following_id))
      .forEach((row: { following_id: string }) => {
        if (!friendsMap.has(row.following_id)) {
          friendsMap.set(row.following_id, null)
          friendIds.push(row.following_id)
        }
      })
  }

  if (friendIds.length === 0) {
    return []
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, banner_image, country')
    .in('id', friendIds)

  return (profiles || []).map((p: ConnectionRow) => ({
    id: p.id,
    username: p.username,
    full_name: p.full_name,
    avatar_url: p.avatar_url,
    banner_image: p.banner_image ?? null,
    country: p.country,
  }))
}
