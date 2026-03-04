import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params
    let supabase

    try {
      const auth = await getAuthenticatedUser(request)
      supabase = auth.supabase
    } catch {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    }

    const isUUID = UUID_RE.test(identifier)
    let ownerId: string

    if (isUUID) {
      ownerId = identifier
    } else {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', identifier)
        .single()
      if (profileError || !profile) {
        return errorResponse('User not found', 404)
      }
      ownerId = profile.id
    }

    const friendsMap = new Map<string, any>()

    const { data: friendReqData } = await supabase
      .from('friend_requests')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${ownerId},receiver_id.eq.${ownerId}`)
      .eq('status', 'accepted')

    const friendIds: string[] = []
    if (friendReqData) {
      friendReqData.forEach((r: any) => {
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
      const followerIds = new Set(followersData.map((f: any) => f.follower_id))
      const mutualFollowIds = followingData
        .filter((f: any) => followerIds.has(f.following_id))
        .map((f: any) => f.following_id)

      mutualFollowIds.forEach((id: string) => {
        if (!friendsMap.has(id)) {
          friendsMap.set(id, null)
          friendIds.push(id)
        }
      })
    }

    if (friendIds.length === 0) {
      return jsonResponse({ data: [] })
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, country')
      .in('id', friendIds)

    const result = (profiles || []).map((p: any) => ({
      id: p.id,
      username: p.username,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      country: p.country,
    }))

    return jsonResponse({ data: result })
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch connections', 500)
  }
}
