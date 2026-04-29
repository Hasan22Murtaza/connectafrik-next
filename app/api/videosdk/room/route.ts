import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { generateVideosdkParticipantJwt } from '@/lib/videosdk-participant-jwt'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { getBusyMapForUserIds } from '@/lib/call-session-busy'
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

  if (check_user_ids.length > 0) {
    try {
      const serviceClient = createServiceClient()
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

  const VIDEOSDK_API_KEY =
    process.env.VIDEOSDK_API_KEY ??
    process.env.VITE_VIDEOSDK_API_KEY ??
    process.env.NEXT_PUBLIC_VIDEOSDK_API_KEY
  const VIDEOSDK_SECRET_KEY =
    process.env.VIDEOSDK_SECRET_KEY ??
    process.env.VIDEOSDK_SECRET ??
    process.env.VITE_VIDEOSDK_SECRET_KEY ??
    process.env.NEXT_PUBLIC_VIDEOSDK_SECRET_KEY

  if (!VIDEOSDK_API_KEY || !VIDEOSDK_SECRET_KEY) {
    return NextResponse.json(
      { error: 'API keys not configured' },
      {
        status: 500,
        headers: corsHeaders,
      },
    )
  }

  try {
    console.log('Creating VideoSDK room...')

    const apiAuthToken = jwt.sign(
      {
        apikey: VIDEOSDK_API_KEY,
        permissions: ['allow_join', 'allow_mod'],
        version: 2,
      },
      VIDEOSDK_SECRET_KEY,
      {
        algorithm: 'HS256',
        expiresIn: '24h',
      },
    )

    const response = await fetch('https://api.videosdk.live/v2/rooms', {
      method: 'POST',
      headers: {
        Authorization: apiAuthToken,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData: { message?: string; error?: string }
      try {
        errorData = JSON.parse(errorText) as { message?: string; error?: string }
      } catch {
        errorData = { message: errorText || `HTTP ${response.status}: ${response.statusText}` }
      }

      console.error('VideoSDK Room API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        apiKey: VIDEOSDK_API_KEY ? `${VIDEOSDK_API_KEY.substring(0, 10)}...` : 'missing',
      })

      return NextResponse.json(
        {
          error: errorData.message || errorData.error || 'Failed to create room',
          details: `Status: ${response.status}. Please verify your API key is correct.`,
          hint: 'Make sure your VIDEOSDK_API_KEY is correct in .env.local',
        },
        {
          status: response.status,
          headers: corsHeaders,
        },
      )
    }

    const data = (await response.json()) as { roomId?: string }

    if (!data.roomId) {
      console.error('Room ID not found in response:', data)
      return NextResponse.json(
        { error: 'Room ID not found in response', response: data },
        {
          status: 500,
          headers: corsHeaders,
        },
      )
    }

    console.log('VideoSDK room created successfully:', data.roomId)

    const json: { roomId: string; token?: string } = { roomId: data.roomId }
    if (include_participant_token) {
      try {
        json.token = await generateVideosdkParticipantJwt(data.roomId, authedUserId)
      } catch (e) {
        console.error('[videosdk/room] participant token failed', e)
      }
    }

    return NextResponse.json(json, { headers: corsHeaders })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Room creation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create room',
        details: message || 'Network error or invalid API endpoint',
        hint: 'Check your internet connection and VideoSDK API endpoint availability',
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    )
  }
}
