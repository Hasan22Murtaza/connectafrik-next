import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { listLiveKitParticipantIdentities } from '@/lib/call-media/livekit'
import { getBusyMapForUserIds } from '@/lib/call-media/session-busy'
import { canMessage } from '@/lib/privacy/access'
import { privacyDecisionResponse } from '@/lib/privacy/http'

type ServiceClient = ReturnType<typeof createServiceClient>
type CallSessionMeta = Record<string, unknown>

const ACTIVE_STATUSES = ['initiated', 'ringing', 'active'] as const

function pushRequestHeaders(request: NextRequest): Record<string, string> {
  const auth = request.headers.get('authorization')
  return {
    'Content-Type': 'application/json',
    ...(auth ? { Authorization: auth } : {}),
  }
}

function mergeSessionMetadata(existing: unknown, patch: CallSessionMeta): CallSessionMeta {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as CallSessionMeta) }
      : {}
  const merged = { ...base, ...patch }
  delete merged.token
  return merged
}

function sanitizeCallSession<T extends Record<string, unknown> | null>(row: T): T {
  if (!row) return row
  return { ...row, metadata: mergeSessionMetadata(row.metadata, {}) }
}

function idsEqual(a: unknown, b: string): boolean {
  return String(a || '').trim().toLowerCase() === b.trim().toLowerCase()
}

function readInvitedUserIds(meta: CallSessionMeta): string[] {
  const fromArray = Array.isArray(meta.invitedUserIds)
    ? (meta.invitedUserIds as unknown[]).filter((id): id is string => typeof id === 'string' && Boolean(id))
    : []
  const singles = [meta.targetUserId, meta.target_user_id, meta.lastInvitedUserId]
    .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
    .map((id) => id.trim())
  return [...new Set([...fromArray, ...singles])]
}

function toPushDataRecord(data: Record<string, unknown>): Record<string, string> {
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

async function ensureDirectThread(
  serviceClient: ServiceClient,
  actorId: string,
  targetUserId: string,
): Promise<string> {
  const pair = [actorId, targetUserId]

  const { data: existingThreads } = await serviceClient
    .from('chat_threads')
    .select('id, chat_participants(user_id)')
    .eq('type', 'direct')

  if (existingThreads && existingThreads.length > 0) {
    const desired = new Set(pair)
    for (const thread of existingThreads as Array<{ id: string; chat_participants?: Array<{ user_id: string }> }>) {
      const threadUserIds = new Set((thread.chat_participants ?? []).map((p) => p.user_id))
      if (threadUserIds.size === desired.size && pair.every((id) => threadUserIds.has(id))) {
        return thread.id
      }
    }
  }

  const { data: thread, error: threadError } = await serviceClient
    .from('chat_threads')
    .insert({
      type: 'direct',
      title: null,
      name: null,
      created_by: actorId,
    })
    .select('id')
    .single()

  if (threadError || !thread?.id) {
    throw new Error(threadError?.message || 'Failed to create invite thread')
  }

  const { error: partError } = await serviceClient.from('chat_participants').insert(
    pair.map((userId) => ({
      thread_id: thread.id,
      user_id: userId,
      role: userId === actorId ? 'admin' : 'member',
    })),
  )

  if (partError) {
    await serviceClient.from('chat_threads').delete().eq('id', thread.id)
    throw new Error(partError.message)
  }

  return thread.id
}

/**
 * Stamp invitee onto every live sibling with this call_id, clear any prior
 * decline, and drop them from participants so a previous join+leave does not
 * look like they are still in the call.
 */
async function syncInviteAcrossCallId(
  serviceClient: ServiceClient,
  callId: string,
  inviteeId: string,
): Promise<void> {
  const cid = callId.trim()
  const invitee = inviteeId.trim()
  if (!cid || !invitee) return

  const { data: siblings } = await serviceClient
    .from('call_sessions')
    .select('id, participants, metadata')
    .eq('call_id', cid)
    .in('status', [...ACTIVE_STATUSES])

  const now = new Date().toISOString()
  await Promise.allSettled(
    (siblings || []).map(async (row: { id: string; participants: unknown; metadata: unknown }) => {
      const meta = mergeSessionMetadata(row.metadata, {})
      const invited = readInvitedUserIds(meta)
      if (!invited.includes(invitee)) invited.push(invitee)

      const declined = Array.isArray(meta.declinedUserIds)
        ? (meta.declinedUserIds as unknown[]).filter(
            (id): id is string => typeof id === 'string' && Boolean(id) && !idsEqual(id, invitee),
          )
        : []

      // Re-invite means they are ringing again — not currently joined.
      const parts = (
        Array.isArray(row.participants) ? (row.participants as string[]).filter(Boolean) : []
      ).filter((id) => !idsEqual(id, invitee))

      await serviceClient
        .from('call_sessions')
        .update({
          participants: parts,
          metadata: mergeSessionMetadata(meta, {
            isGroupCall: true,
            invitedUserIds: invited,
            lastInvitedUserId: invitee,
            lastInvitedAt: now,
            declinedUserIds: declined,
            activeParticipantCount: Math.max(
              typeof meta.activeParticipantCount === 'number' ? meta.activeParticipantCount : 0,
              parts.length,
              invited.length + 1,
            ),
          }),
          updated_at: now,
        })
        .eq('id', row.id)
    }),
  )
}

/**
 * POST /api/chat/calls/invite
 *
 * Mid-call Add People invite. Unlike POST /call-sessions, this always re-rings
 * the invitee even if they previously joined+left, declined, or missed the same call.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const apiBaseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    const body = await request.json()

    const call_id = typeof body.call_id === 'string' ? body.call_id.trim() : ''
    const room_id = typeof body.room_id === 'string' ? body.room_id.trim() : ''
    const target_user_id =
      typeof body.target_user_id === 'string' && body.target_user_id.trim()
        ? body.target_user_id.trim()
        : ''
    const call_type = body.call_type === 'video' ? 'video' : body.call_type === 'audio' ? 'audio' : ''
    const provider =
      body.provider === 'livekit' || body.provider === 'videosdk' ? body.provider : undefined
    const caller_name =
      typeof body.caller_name === 'string' && body.caller_name.trim()
        ? body.caller_name.trim()
        : user.email || 'Someone'
    let caller_avatar_url =
      typeof body.caller_avatar_url === 'string' ? body.caller_avatar_url.trim() : ''

    if (!call_id || !room_id || !target_user_id || !call_type) {
      return errorResponse('call_id, room_id, target_user_id, and call_type are required', 400)
    }
    if (idsEqual(target_user_id, user.id)) {
      return errorResponse('Cannot invite yourself', 400)
    }

    if (!caller_avatar_url) {
      const { data: prof } = await serviceClient
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle()
      if (prof?.avatar_url && typeof prof.avatar_url === 'string') {
        caller_avatar_url = prof.avatar_url.trim()
      }
    }

    const { data: liveRows, error: liveError } = await serviceClient
      .from('call_sessions')
      .select('*')
      .eq('call_id', call_id)
      .in('status', [...ACTIVE_STATUSES])
      .order('updated_at', { ascending: false })

    if (liveError) return errorResponse(liveError.message, 400)
    const liveSessions = liveRows || []
    if (liveSessions.length === 0) {
      return errorResponse('Call is no longer active', 409)
    }

    const inviterInCall = liveSessions.some((row) => {
      if (idsEqual(row.created_by, user.id)) return true
      const parts = Array.isArray(row.participants) ? (row.participants as string[]) : []
      return parts.some((id) => idsEqual(id, user.id))
    })
    if (!inviterInCall) {
      return errorResponse('Only call participants can invite others', 403)
    }

    // Prefer media presence: leave may not clear invitee from every sibling
    // participants[] row that was stamped on join.
    const sourceMeta = mergeSessionMetadata(liveSessions[0]?.metadata, {})
    const sourceProvider =
      provider ||
      (typeof sourceMeta.provider === 'string' ? sourceMeta.provider.trim() : '') ||
      ''
    if (!sourceProvider || sourceProvider === 'livekit') {
      const identities = await listLiveKitParticipantIdentities(room_id)
      if (identities && identities.some((id) => idsEqual(id, target_user_id))) {
        return errorResponse('This person is already in the call', 409)
      }
    } else {
      const inviteeAlreadyJoined = liveSessions.some((row) => {
        const parts = Array.isArray(row.participants) ? (row.participants as string[]) : []
        if (!parts.some((id) => idsEqual(id, target_user_id))) return false
        const meta = mergeSessionMetadata(row.metadata, {})
        // If the last signal for this user was leave/decline, treat as not in-call.
        if (idsEqual(meta.leftBy, target_user_id) || idsEqual(meta.rejectedBy, target_user_id)) {
          return false
        }
        return true
      })
      if (inviteeAlreadyJoined) {
        return errorResponse('This person is already in the call', 409)
      }
    }

    const busy = await getBusyMapForUserIds(serviceClient, [target_user_id], call_id)
    if (busy[target_user_id]) {
      return errorResponse('This person is already in another call', 409)
    }

    const messageDecision = await canMessage(user.id, target_user_id, serviceClient)
    const messageDenied = privacyDecisionResponse(messageDecision)
    if (messageDenied) return messageDenied

    const inviteThreadId = await ensureDirectThread(serviceClient, user.id, target_user_id)

    const { assertCanCallThread } = await import('@/lib/privacy/chat')
    const callDecision = await assertCanCallThread(serviceClient, user.id, inviteThreadId, true)
    const callDenied = privacyDecisionResponse(callDecision)
    if (callDenied) return callDenied

    const now = new Date().toISOString()
    const inviteMetadata = mergeSessionMetadata(null, {
      targetUserId: target_user_id,
      isGroupCall: true,
      callerName: caller_name,
      callerAvatarUrl: caller_avatar_url,
      callType: call_type,
      roomId: room_id,
      callId: call_id,
      timestamp: now,
      last_signal: 'ringing',
      invitedUserIds: [target_user_id],
      lastInvitedUserId: target_user_id,
      lastInvitedAt: now,
      reinvited: true,
      ...(provider ? { provider } : {}),
    })

    const { data: existingInviteRows } = await serviceClient
      .from('call_sessions')
      .select('*')
      .eq('thread_id', inviteThreadId)
      .eq('call_id', call_id)
      .order('created_at', { ascending: false })
      .limit(1)

    const existingInvite =
      Array.isArray(existingInviteRows) && existingInviteRows.length > 0 ? existingInviteRows[0] : null

    let session: Record<string, unknown> | null = null

    if (existingInvite) {
      const priorMeta = mergeSessionMetadata(existingInvite.metadata, {})
      const declined = Array.isArray(priorMeta.declinedUserIds)
        ? (priorMeta.declinedUserIds as unknown[]).filter(
            (id): id is string => typeof id === 'string' && Boolean(id) && !idsEqual(id, target_user_id),
          )
        : []

      const { data: updated, error: updateError } = await serviceClient
        .from('call_sessions')
        .update({
          status: 'ringing',
          call_type,
          room_id,
          // Bump started_at so /api/chat/calls/incoming's recent window
          // treats this as a fresh ring (re-invite after a long call).
          started_at: now,
          participants: [user.id],
          ended_at: null,
          duration_seconds: null,
          last_heartbeat_at: null,
          metadata: mergeSessionMetadata(priorMeta, {
            ...inviteMetadata,
            declinedUserIds: declined,
            // Drop terminal signals so the invitee UI treats this as a fresh ring.
            rejectedBy: null,
            rejectedAt: null,
            leftBy: null,
            leftAt: null,
            missedBy: null,
            missedAt: null,
            endedBy: null,
            endedAt: null,
          }),
          updated_at: now,
        })
        .eq('id', existingInvite.id)
        .select('*')
        .single()

      if (updateError || !updated) {
        return errorResponse(updateError?.message || 'Failed to re-invite participant', 400)
      }
      session = updated
    } else {
      const { data: inserted, error: insertError } = await serviceClient
        .from('call_sessions')
        .insert({
          thread_id: inviteThreadId,
          call_type,
          status: 'ringing',
          started_at: now,
          created_by: user.id,
          participants: [user.id],
          room_id,
          call_id,
          metadata: inviteMetadata,
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .single()

      if (insertError || !inserted) {
        return errorResponse(insertError?.message || 'Failed to create invite session', 400)
      }
      session = inserted
    }

    await syncInviteAcrossCallId(serviceClient, call_id, target_user_id)

    await serviceClient
      .from('chat_threads')
      .update({
        last_message_preview: `Incoming ${call_type === 'video' ? 'video' : 'audio'} call`,
        last_message_at: now,
        last_activity_at: now,
        updated_at: now,
      })
      .eq('id', inviteThreadId)

    const pushData = toPushDataRecord({
      type: 'ringing',
      call_type,
      room_id,
      thread_id: inviteThreadId,
      actor_name: caller_name,
      call_id,
      callId: call_id,
      caller_id: user.id,
      caller_name,
      caller_avatar_url: caller_avatar_url || '',
      is_group_call: 'true',
      isGroupCall: 'true',
      sent_at: now,
      url: `/call/${room_id}`,
    })

    try {
      const response = await fetch(`${apiBaseUrl}/api/push-notifications`, {
        method: 'POST',
        headers: pushRequestHeaders(request),
        body: JSON.stringify({
          user_id: target_user_id,
          title: `Incoming ${call_type === 'video' ? 'Video' : 'Audio'} Call`,
          body: `${caller_name} is calling you...`,
          notification_type: 'call',
          skip_db: true,
          // Unique tag per invite attempt so a re-invite is not collapsed with the first ring.
          tag: `incoming-call-${inviteThreadId}-${Date.now()}`,
          requireInteraction: true,
          silent: false,
          vibrate: [200, 100, 200, 100, 200, 100, 200],
          data: pushData,
        }),
        cache: 'no-store',
      })
      if (!response.ok) {
        const message = await response.text().catch(() => '')
        console.error('Failed to send invite ringing push', {
          status: response.status,
          body: message,
          user_id: target_user_id,
        })
      }
    } catch (error) {
      console.error('Failed to call /api/push-notifications for call invite', {
        error: error instanceof Error ? error.message : String(error),
        user_id: target_user_id,
      })
    }

    return jsonResponse({
      session: sanitizeCallSession(session),
      thread_id: inviteThreadId,
      reinvited: Boolean(existingInvite),
    })
  } catch (e: any) {
    if (e.message === 'Unauthorized' || e.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(e.message || 'Failed to invite participant', 500)
  }
}
