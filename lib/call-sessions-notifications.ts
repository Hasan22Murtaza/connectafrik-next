import type { SupabaseClient } from '@supabase/supabase-js'

function getInternalSiteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  const trimmed = (raw || '').replace(/\/$/, '')
  return trimmed || 'http://localhost:3000'
}

async function postInternalPushNotification(payload: Record<string, unknown>): Promise<void> {
  const url = `${getInternalSiteOrigin()}/api/push-notifications`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.warn('[call-sessions] push failed', res.status, text)
  }
}

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

async function resolveTargetUserIds(
  serviceClient: SupabaseClient,
  threadId: string,
  actorId: string,
  targetUserId?: string | null
): Promise<string[]> {
  if (targetUserId && targetUserId.trim()) {
    return targetUserId.trim() === actorId ? [] : [targetUserId.trim()]
  }
  const { data: rows } = await serviceClient
    .from('chat_participants')
    .select('user_id')
    .eq('thread_id', threadId)
    .neq('user_id', actorId)
  const ids = (rows || []).map((r: { user_id: string }) => r.user_id).filter(Boolean)
  return Array.from(new Set(ids))
}

type CallSessionMeta = Record<string, unknown>

/** Persist in-app notification row using the same service client as the route (no HTTP self-fetch). */
async function insertCallNotificationRow(
  serviceClient: SupabaseClient,
  params: {
    user_id: string
    title: string
    message: string
    preferredType: 'ringing' | 'missed' | 'declined' | 'ended' | 'active' | 'system'
    data: Record<string, string>
  }
): Promise<void> {
  const base = {
    user_id: params.user_id,
    title: params.title,
    message: params.message,
    is_read: false,
  }
  const tries: Record<string, unknown>[] = [
    { ...base, type: params.preferredType, data: params.data },
    { ...base, type: 'system', data: { ...params.data, type: params.preferredType } },
    { ...base, type: 'system', payload: params.data },
    { ...base, type: 'system', metadata: params.data },
  ]

  for (let i = 0; i < tries.length; i += 1) {
    const { error } = await serviceClient.from('notifications').insert(tries[i] as never).select('id').maybeSingle()
    if (!error) {
      if (i > 0) console.info('[call-sessions] notification insert succeeded with fallback shape', { attempt: i })
      return
    }
    console.warn('[call-sessions] notification insert attempt failed', { attempt: i, message: error.message })
  }
  console.error('[call-sessions] notification insert failed after all fallbacks')
}

/** Incoming ring: push-only (no DB notification row). */
export async function sendCallSessionPushes(params: {
  serviceClient: SupabaseClient
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
    recipients.map(async (user_id) => {
      await postInternalPushNotification({
        user_id,
        title,
        body: message,
        notification_type: 'ringing',
        skip_db: true,
        tag: `incoming-call-${threadId}`,
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200, 100, 200, 100, 200],
        data,
      })
    })
  )
}

/** Persist in-app notification rows for call outcomes (no push). */
export async function sendCallSessionStatusNotifications(params: {
  serviceClient: SupabaseClient
  threadId: string
  actorId: string
  actorName: string
  callType: string
  roomId: string
  callId: string
  status: 'missed' | 'declined' | 'ended' | 'active'
  targetUserId?: string | null
}): Promise<void> {
  const {
    serviceClient,
    threadId,
    actorId,
    actorName,
    callType,
    roomId,
    callId,
    status,
    targetUserId,
  } = params

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
    recipients.map((user_id) =>
      insertCallNotificationRow(serviceClient, {
        user_id,
        title,
        message,
        preferredType: status,
        data,
      })
    )
  )
}

export function mergeSessionMetadata(existing: unknown, patch: CallSessionMeta): CallSessionMeta {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as CallSessionMeta) }
      : {}
  return { ...base, ...patch }
}
