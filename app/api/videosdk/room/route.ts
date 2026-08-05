import { NextRequest, NextResponse } from 'next/server'
import { createCallRoom } from '@/lib/call-media/provider'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { getBusyMapForUserIds } from '@/lib/call-media/session-busy'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeUserIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [
    ...new Set(
      raw
        .filter((x: unknown): x is string => typeof x === 'string' && Boolean(x.trim()))
        .map((x: string) => x.trim()),
    ),
  ]
}

export async function OPTIONS() {
  return new NextResponse('ok', { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  let authedUserId: string
  try {
    const { user } = await getAuthenticatedUser(request)
    authedUserId = user.id
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'Unauthorized' || msg === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return NextResponse.json(
      { error: msg || 'Unauthorized' },
      { status: 401, headers: corsHeaders },
    )
  }

  let body: Record<string, unknown> = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text) as Record<string, unknown>
  } catch {
    body = {}
  }

  if (body.busy_check === true) {
    const user_ids = normalizeUserIds(body.user_ids)
    const exclude_call_id =
      typeof body.exclude_call_id === 'string' ? body.exclude_call_id.trim() : ''
    if (user_ids.length > 50) {
      return errorResponse('Too many user_ids (max 50)', 400)
    }
    try {
      const serviceClient = createServiceClient()
      const busy = await getBusyMapForUserIds(serviceClient, user_ids, exclude_call_id)
      const res = jsonResponse({ busy })
      Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v))
      return res
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to check call status'
      return errorResponse(msg, 500)
    }
  }

  const check_user_ids = normalizeUserIds(body.check_user_ids)
  if (check_user_ids.length > 50) {
    return NextResponse.json(
      { error: 'Too many check_user_ids (max 50)' },
      { status: 400, headers: corsHeaders },
    )
  }

  const include_participant_token = body.include_participant_token === true
  const display_name = typeof body.display_name === 'string' ? body.display_name.trim() : ''
  const avatar_url = typeof body.avatar_url === 'string' ? body.avatar_url.trim() : ''

  if (check_user_ids.length > 0) {
    try {
      const serviceClient = createServiceClient()

      // 1:1 outbound calls must be between accepted friends.
      for (const otherUserId of check_user_ids) {
        if (otherUserId === authedUserId) continue
        const { data: friendshipRows, error: friendshipError } = await serviceClient
          .from('friend_requests')
          .select('id')
          .eq('status', 'accepted')
          .or(
            `and(sender_id.eq.${authedUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${authedUserId})`
          )
          .limit(1)

        if (friendshipError) {
          console.warn('[videosdk/room] friendship check failed', friendshipError)
          return NextResponse.json(
            { error: 'Could not verify friendship. Please try again.' },
            { status: 500, headers: corsHeaders },
          )
        }
        if (!friendshipRows?.length) {
          return NextResponse.json(
            {
              error: 'You need to be friends to start a call.',
              code: 'FRIENDS_REQUIRED_FOR_CALL',
            },
            { status: 403, headers: corsHeaders },
          )
        }
      }

      const busy = await getBusyMapForUserIds(serviceClient, check_user_ids, '')
      const blocked = check_user_ids.some((id) => busy[id])
      if (blocked) {
        return NextResponse.json(
          { error: 'On an other call.' },
          { status: 409, headers: corsHeaders },
        )
      }
    } catch (e: unknown) {
      console.warn('[videosdk/room] busy check failed; continuing', e)
    }
  }

  try {
    const credentials = await createCallRoom({
      userId: authedUserId,
      includeParticipantToken: include_participant_token,
      ...(display_name ? { displayName: display_name } : {}),
      ...(avatar_url ? { avatarUrl: avatar_url } : {}),
    })

    const json: {
      roomId: string
      token?: string
      provider: string
      wsUrl?: string
    } = {
      roomId: credentials.roomId,
      provider: credentials.provider,
    }

    if (credentials.token) {
      json.token = credentials.token
    }
    if (credentials.wsUrl) {
      json.wsUrl = credentials.wsUrl
    }

    return NextResponse.json(json, { headers: corsHeaders })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[videosdk/room] room creation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create room',
        details: message || 'No call media provider is available',
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    )
  }
}
