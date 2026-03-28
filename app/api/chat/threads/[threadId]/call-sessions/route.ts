import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ threadId: string }> }

const ACTIVE_STATUSES = ['initiated', 'ringing', 'active']
type ServiceClient = ReturnType<typeof createServiceClient>
type CallSessionMeta = Record<string, unknown>

const toPushDataRecord = (data: Record<string, unknown>): Record<string, string> => {
  const entries = Object.entries(data).flatMap(([key, value]) => {
    if (value === undefined || value === null) return []
    if (typeof value === 'string') return [[key, value] as [string, string]]
    if (typeof value === 'number' || typeof value === 'boolean') return [[key, String(value)] as [string, string]]
    try {
      return [[key, JSON.stringify(value)] as [string, string]]
    } catch {
      return [[key, String(value)] as [string, string]]
    }
  })
  return Object.fromEntries(entries)
}

function mergeSessionMetadata(existing: unknown, patch: CallSessionMeta): CallSessionMeta {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as CallSessionMeta) }
      : {}
  return { ...base, ...patch }
}

async function resolveTargetUserIds(
  serviceClient: ServiceClient,
  threadId: string,
  actorId: string,
  targetUserId?: string | null
): Promise<string[]> {
  if (targetUserId && targetUserId.trim()) {
    const normalizedTarget = targetUserId.trim()
    
    if (normalizedTarget !== actorId) {
      return [normalizedTarget]
    }
  }
  const { data: rows } = await serviceClient
    .from('chat_participants')
    .select('user_id')
    .eq('thread_id', threadId)
    .neq('user_id', actorId)
  const ids = (rows || []).map((r: { user_id: string }) => r.user_id).filter(Boolean)
  return Array.from(new Set(ids))
}

async function sendPushNotificationViaApi(
  apiBaseUrl: string,
  payload: {
    user_id: string
    title: string
    body: string
    notification_type: 'call'
    skip_db?: boolean
    tag?: string
    requireInteraction?: boolean
    silent?: boolean
    vibrate?: number[]
    data: Record<string, string>
  }
): Promise<void> {
  try {
    console.log('apiBaseUrlhas been called', `${apiBaseUrl}/api/push-notifications`)
    console.log('payload has been called', payload)
    const response = await fetch(`${apiBaseUrl}/api/push-notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
    if (!response.ok) {
      const message = await response.text().catch(() => '')
      console.error('Failed to send push via /api/push-notifications', {
        status: response.status,
        statusText: response.statusText,
        body: message,
        user_id: payload.user_id,
      })
    }
  } catch (error) {
    console.error('Failed to call /api/push-notifications', {
      error: error instanceof Error ? error.message : String(error),
      user_id: payload.user_id,
    })
  }
}

async function sendCallSessionPushes(params: {
  apiBaseUrl: string
  serviceClient: ServiceClient
  threadId: string
  actorId: string
  actorName: string
  callType: string
  roomId: string
  callId: string
  token?: string
  targetUserId?: string | null
  isGroupCall?: boolean
  callerAvatarUrl?: string
}): Promise<void> {
  const {
    apiBaseUrl,
    serviceClient,
    threadId,
    actorId,
    actorName,
    callType,
    roomId,
    callId,
    token,
    targetUserId,
    isGroupCall,
    callerAvatarUrl,
  } = params
  const recipients = await resolveTargetUserIds(serviceClient, threadId, actorId, targetUserId || undefined)
  if (recipients.length === 0) return
  const sentAt = new Date().toISOString()
  const title = `Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`
  const message = `${actorName} is calling you...`
  const data = toPushDataRecord({
    type: 'ringing',
    call_type: callType,
    room_id: roomId,
    thread_id: threadId,
    actor_name: actorName,
    ...(token ? { token } : {}),
    call_id: callId,
    callId,
    caller_id: actorId,
    caller_name: actorName,
    caller_avatar_url: callerAvatarUrl || '',
    is_group_call: isGroupCall ? 'true' : 'false',
    isGroupCall: isGroupCall ? 'true' : 'false',
    sent_at: sentAt,
    url: `/call/${roomId}`,
  })
  await Promise.allSettled(
    recipients.map((user_id) =>
      sendPushNotificationViaApi(apiBaseUrl, {
        user_id,
        title,
        body: message,
        notification_type: 'call',
        skip_db: true,
        tag: `incoming-call-${threadId}`,
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200, 100, 200, 100, 200],
        data,
      })
    )
  )
}

async function sendCallSessionStatusNotifications(params: {
  apiBaseUrl: string
  serviceClient: ServiceClient
  threadId: string
  actorId: string
  actorName: string
  callType: string
  roomId: string
  callId: string
  status: 'missed' | 'declined' | 'ended' | 'active'
  targetUserId?: string | null
}): Promise<void> {
  const { apiBaseUrl, serviceClient, threadId, actorId, actorName, callType, roomId, callId, status, targetUserId } =
    params
  const recipients = await resolveTargetUserIds(serviceClient, threadId, actorId, targetUserId || undefined)
  if (recipients.length === 0) return
  const title =
    status === 'declined'
      ? 'Call declined'
      : status === 'ended'
        ? 'Call ended'
        : status === 'active'
          ? 'Call accepted'
          : 'Missed Call'
  const message =
    status === 'declined'
      ? `${actorName} declined your ${callType} call`
      : status === 'ended'
        ? 'Call ended'
        : status === 'active'
          ? `${actorName} accepted your ${callType} call`
          : `${actorName} tried to ${callType} call you`
  const data = toPushDataRecord({
    type: status,
    call_type: callType,
    room_id: roomId,
    thread_id: threadId,
    actor_name: actorName,
    call_id: callId,
    callId,
    caller_id: actorId,
    caller_name: actorName,
    sent_at: new Date().toISOString(),
    url: threadId ? `/chat?thread=${threadId}` : '/feed',
  })
  await Promise.allSettled(
    recipients.map(async (user_id) => {
      await sendPushNotificationViaApi(apiBaseUrl, {
        user_id: user_id,
        title,
        body: message,
        notification_type: 'call',
        tag: `call-status-${status}-${threadId}`,
        requireInteraction: false,
        silent: false,
        vibrate: [200, 100, 200],
        data,
      })
    })
  )
}

async function assertThreadMember(serviceClient: ServiceClient, threadId: string, userId: string) {
  const { data: participant } = await serviceClient
    .from('chat_participants')
    .select('id')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .maybeSingle()
  return Boolean(participant)
}

async function touchThreadPreview(
  serviceClient: ReturnType<typeof createServiceClient>,
  threadId: string,
  preview: string
) {
  const now = new Date().toISOString()
  await serviceClient
    .from('chat_threads')
    .update({
      last_message_preview: preview,
      last_message_at: now,
      last_activity_at: now,
      updated_at: now,
    })
    .eq('id', threadId)
}

async function resolveActorName(serviceClient: ReturnType<typeof createServiceClient>, userId: string): Promise<string> {
  const { data } = await serviceClient
    .from('profiles')
    .select('full_name, username')
    .eq('id', userId)
    .maybeSingle()
  return (data?.full_name || data?.username || 'Someone') as string
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    if (!(await assertThreadMember(serviceClient, threadId, user.id))) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const { searchParams } = new URL(request.url)
    const callId = (searchParams.get('call_id') || '').trim()
    if (!callId) {
      return errorResponse('call_id is required', 400)
    }

    const { data: row, error } = await serviceClient
      .from('call_sessions')
      .select('*')
      .eq('thread_id', threadId)
      .eq('call_id', callId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ session: row || null })
  } catch (e: any) {
    if (e.message === 'Unauthorized' || e.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(e.message || 'Failed to load call session', 500)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const apiBaseUrl = new URL(request.url).origin
    const body = await request.json()

    const call_id = typeof body.call_id === 'string' ? body.call_id.trim() : ''
    const call_type = body.call_type === 'video' ? 'video' : body.call_type === 'audio' ? 'audio' : ''
    const room_id = typeof body.room_id === 'string' ? body.room_id.trim() : ''
    const token = typeof body.token === 'string' ? body.token : undefined
    const target_user_id =
      typeof body.target_user_id === 'string' && body.target_user_id.trim() ? body.target_user_id.trim() : undefined
    const is_group_call = body.is_group_call === true
    const caller_name = typeof body.caller_name === 'string' ? body.caller_name : user.email || 'Someone'
    const caller_avatar_url = typeof body.caller_avatar_url === 'string' ? body.caller_avatar_url : ''

    if (!call_id || !call_type || !room_id) {
      return errorResponse('call_id, call_type, and room_id are required', 400)
    }

    if (!(await assertThreadMember(serviceClient, threadId, user.id))) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const { data: existing } = await serviceClient
      .from('call_sessions')
      .select('*')
      .eq('thread_id', threadId)
      .eq('call_id', call_id)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return jsonResponse({ session: existing })
    }

    const metadata = mergeSessionMetadata(null, {
      token: token || undefined,
      targetUserId: target_user_id,
      isGroupCall: is_group_call,
      callerName: caller_name,
      callerAvatarUrl: caller_avatar_url,
      callType: call_type,
      roomId: room_id,
      callId: call_id,
      timestamp: new Date().toISOString(),
      last_signal: 'ringing',
    })

    const now = new Date().toISOString()
    const { data: session, error: insertError } = await serviceClient
      .from('call_sessions')
      .insert({
        thread_id: threadId,
        call_type,
        status: 'ringing',
        started_at: now,
        created_by: user.id,
        participants: [user.id],
        room_id,
        call_id,
        metadata,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single()

    if (insertError || !session) {
      return errorResponse(insertError?.message || 'Failed to create call session', 400)
    }

    await touchThreadPreview(
      serviceClient,
      threadId,
      `Incoming ${call_type === 'video' ? 'video' : 'audio'} call`
    )

    await sendCallSessionPushes({
      apiBaseUrl,
      serviceClient,
      threadId,
      actorId: user.id,
      actorName: caller_name,
      callType: call_type,
      roomId: room_id,
      callId: call_id,
      token,
      targetUserId: target_user_id || null,
      isGroupCall: is_group_call,
      callerAvatarUrl: caller_avatar_url,
    })

    return jsonResponse({ session })
  } catch (e: any) {
    if (e.message === 'Unauthorized' || e.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(e.message || 'Failed to start call session', 500)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const apiBaseUrl = new URL(request.url).origin
    console.log('apiBaseUrl', apiBaseUrl)
    console.log('request.url', request.url)

    const body = await request.json()

    const call_id = typeof body.call_id === 'string' ? body.call_id.trim() : ''
    const event = body.event as string | undefined
    const duration_seconds =
      typeof body.duration_seconds === 'number' && Number.isFinite(body.duration_seconds)
        ? Math.max(0, Math.floor(body.duration_seconds))
        : undefined

    if (!call_id) return errorResponse('call_id is required', 400)
    if (!['accept', 'reject', 'end', 'missed'].includes(event || '')) {
      return errorResponse('event must be accept | reject | end | missed', 400)
    }

    if (!(await assertThreadMember(serviceClient, threadId, user.id))) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const { data: row, error: fetchError } = await serviceClient
      .from('call_sessions')
      .select('*')
      .eq('thread_id', threadId)
      .eq('call_id', call_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) return errorResponse(fetchError.message, 400)
    if (!row) return errorResponse('Call session not found', 404)

    const baseMeta = mergeSessionMetadata(row.metadata, {})

    let nextStatus = row.status as string
    let nextParticipants: string[] = Array.isArray(row.participants) ? [...row.participants] : []
    let nextEndedAt: string | null = row.ended_at
    let nextDuration: number | null = row.duration_seconds
    const now = new Date().toISOString()
    let metaPatch: Record<string, unknown> = {}

    if (event === 'accept') {
      nextStatus = 'active'
      if (!nextParticipants.includes(user.id)) nextParticipants.push(user.id)
      metaPatch = {
        acceptedBy: user.id,
        acceptedAt: now,
        last_signal: 'active',
      }
    } else if (event === 'reject') {
      nextStatus = 'declined'
      nextEndedAt = now
      metaPatch = {
        rejectedBy: user.id,
        rejectedAt: now,
        last_signal: 'declined',
      }
    } else if (event === 'end') {
      nextStatus = 'ended'
      nextEndedAt = now
      if (duration_seconds !== undefined) nextDuration = duration_seconds
      metaPatch = {
        endedBy: user.id,
        endedAt: now,
        last_signal: 'ended',
      }
    } else if (event === 'missed') {
      const extra = body.extra_metadata && typeof body.extra_metadata === 'object' ? body.extra_metadata : {}
      // Client may send "missed" while ref/UI lags after callee accept; DB truth is already active.
      if (row.status === 'active') {
        nextStatus = 'ended'
        nextEndedAt = now
        if (duration_seconds !== undefined) nextDuration = duration_seconds
        metaPatch = {
          endedBy: user.id,
          endedAt: now,
          last_signal: 'ended',
          ...extra,
        }
      } else {
        nextStatus = 'missed'
        nextEndedAt = now
        metaPatch = {
          endedBy: user.id,
          endedAt: now,
          last_signal: 'missed',
          ...extra,
        }
      }
    }

    const nextMetadata = mergeSessionMetadata(baseMeta, metaPatch)

    const { data: updated, error: updateError } = await serviceClient
      .from('call_sessions')
      .update({
        status: nextStatus,
        participants: nextParticipants,
        ended_at: nextEndedAt,
        duration_seconds: nextDuration,
        metadata: nextMetadata,
        updated_at: now,
      })
      .eq('id', row.id)
      .select('*')
      .single()

    if (updateError || !updated) {
      return errorResponse(updateError?.message || 'Failed to update call session', 400)
    }

    const preview =
      nextStatus === 'ended'
        ? 'Call ended'
        : nextStatus === 'missed'
          ? 'Missed call'
          : nextStatus === 'declined'
            ? 'Call declined'
            : nextStatus === 'active'
              ? 'Call accepted'
              : 'Call update'
    await touchThreadPreview(serviceClient, threadId, preview)

    if (nextStatus === 'missed' || nextStatus === 'declined' || nextStatus === 'active') {
      const actorName = await resolveActorName(serviceClient, user.id)
      const callType = (updated.call_type === 'video' ? 'video' : 'audio') as 'video' | 'audio'
      const metaObj =
        updated.metadata && typeof updated.metadata === 'object' && !Array.isArray(updated.metadata)
          ? (updated.metadata as Record<string, unknown>)
          : {}
      const targetUserId =
        (typeof metaObj.targetUserId === 'string' && metaObj.targetUserId) ||
        (typeof metaObj.target_user_id === 'string' && metaObj.target_user_id) ||
        null
      await sendCallSessionStatusNotifications({
        apiBaseUrl,
        serviceClient,
        threadId,
        actorId: user.id,
        actorName,
        callType,
        roomId: String(updated.room_id || ''),
        callId: String(updated.call_id || ''),
        status: nextStatus as 'missed' | 'declined' | 'active',
        targetUserId,
      })
    }

    // Push only for POST (incoming ring). Accept/reject/end/missed are delivered in-app via Realtime on call_sessions.

    return jsonResponse({ session: updated })
  } catch (e: any) {
    if (e.message === 'Unauthorized' || e.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(e.message || 'Failed to update call session', 500)
  }
}
