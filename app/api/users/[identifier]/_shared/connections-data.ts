import type { SupabaseClient } from '@supabase/supabase-js'

export type ConnectionRow = {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
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

  const [{ data: followersData }, { data: followingData }] = await Promise.all([
    supabase.from('follows').select('follower_id').eq('following_id', ownerId),
    supabase.from('follows').select('following_id').eq('follower_id', ownerId),
  ])

  if (followersData && followingData) {
    const followerIds = new Set(followersData.map((f: { follower_id: string }) => f.follower_id))
    const mutualFollowIds = followingData
      .filter((f: { following_id: string }) => followerIds.has(f.following_id))
      .map((f: { following_id: string }) => f.following_id)

    mutualFollowIds.forEach((id: string) => {
      if (!friendsMap.has(id)) {
        friendsMap.set(id, null)
        friendIds.push(id)
      }
    })
  }

  if (friendIds.length === 0) {
    return []
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, country')
    .in('id', friendIds)

  return (profiles || []).map((p: ConnectionRow) => ({
    id: p.id,
    username: p.username,
    full_name: p.full_name,
    avatar_url: p.avatar_url,
    country: p.country,
  }))
}
