import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { notificationService } from '@/shared/services/notificationService'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 50)
    const from = page * limit
    const to = from + limit - 1

    const { data: requests, error: reqError } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status, created_at, updated_at')
      .eq('status', 'accepted')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (reqError) {
      return errorResponse(reqError.message, 400)
    }

    const rows = requests || []
    const otherIds = [...new Set(rows.map((r: any) => r.sender_id === user.id ? r.receiver_id : r.sender_id))]

    if (otherIds.length === 0) {
      return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
    }

    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, country, bio, birthday, status, last_seen')
      .in('id', otherIds)

    if (profError) {
      return errorResponse(profError.message, 400)
    }

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

    const friends = rows.map((r: any) => {
      const otherId = r.sender_id === user.id ? r.receiver_id : r.sender_id
      const profile = profileMap.get(otherId)
      if (!profile) return null
      return {
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        country: profile.country,
        bio: profile.bio,
        birthday: profile.birthday,
        friendship_date: r.created_at,
        status: profile.status,
        last_seen: profile.last_seen,
      }
    }).filter(Boolean)

    return jsonResponse({ data: friends, page, pageSize: limit, hasMore: rows.length === limit })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to list friends', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const body = await request.json().catch(() => ({}))
    const receiver_id = body?.receiver_id

    if (!receiver_id || typeof receiver_id !== 'string') {
      return errorResponse('receiver_id is required', 400)
    }

    if (receiver_id === user.id) {
      return errorResponse('Cannot send friend request to yourself', 400)
    }

    const { data: existingList } = await supabase
      .from('friend_requests')
      .select('id, status, sender_id')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiver_id}),and(sender_id.eq.${receiver_id},receiver_id.eq.${user.id})`)
      .limit(2)

    const existing = existingList?.[0]
    if (existing) {
      if (existing.status === 'pending') {
        const isSentByMe = existing.sender_id === user.id
        return errorResponse(isSentByMe ? 'Request already sent' : 'Request already received', 400)
      }
      return errorResponse('Friend request already exists', 400)
    }

    const { data: inserted, error: insertError } = await supabase
      .from('friend_requests')
      .insert({ sender_id: user.id, receiver_id, status: 'pending' })
      .select()
      .single()

    if (insertError) {
      return errorResponse(insertError.message, 400)
    }

    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', user.id)
      .single()

    const senderName = senderProfile?.full_name || senderProfile?.username || 'Someone'
    await notificationService.sendNotification({
      user_id: receiver_id,
      title: 'Friend request',
      body: `${senderName} sent you a friend request`,
      notification_type: 'friend_request',
      data: { sender_id: user.id, sender_name: senderName, url: '/friends' },
    })

    return jsonResponse(inserted, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to send friend request', 500)
  }
}
