import { NextRequest } from 'next/server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chat/chatThreadAccess'
import {
  canonicalPublicKey,
  listActiveCallDevices,
  listThreadParticipantIds,
  normalizeId,
  registerCallDevice,
  usersMissingDevices,
} from '@/lib/call-e2ee/persist'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server'

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message === 'Unauthorized' || message === 'Missing Authorization header') return unauthorizedResponse()
  return null
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const service = createServiceClient()
    const threadId = request.nextUrl.searchParams.get('thread_id')?.trim() || ''
    const userId = normalizeId(request.nextUrl.searchParams.get('user_id'))

    let userIds: string[] = []
    if (threadId) {
      if (!(await requireChatThreadAccess(service, user.id, threadId))) {
        return errorResponse('Thread not found or access denied', 404)
      }
      userIds = await listThreadParticipantIds(service, threadId)
    } else if (userId) {
      if (userId === normalizeId(user.id)) {
        userIds = [userId]
      } else {
        const { data: shared, error } = await service
          .from('chat_participants')
          .select('thread_id')
          .eq('user_id', user.id)
        if (error) return errorResponse(error.message, 400)
        const threadIds = (shared || []).map((row) => row.thread_id).filter(Boolean)
        let allowed = false
        if (threadIds.length > 0) {
          const { data: peer, error: peerError } = await service
            .from('chat_participants')
            .select('thread_id')
            .eq('user_id', userId)
            .in('thread_id', threadIds)
            .limit(1)
          if (peerError) return errorResponse(peerError.message, 400)
          allowed = Array.isArray(peer) && peer.length > 0
        }
        if (!allowed) return errorResponse('You cannot read that device key', 403)
        userIds = [userId]
      }
    } else {
      return errorResponse('thread_id or user_id is required', 400)
    }

    const devices = await listActiveCallDevices(service, userIds)
    return jsonResponse({
      devices,
      missingUserIds: usersMissingDevices(userIds, devices),
    })
  } catch (error) {
    return authError(error) ?? errorResponse(error instanceof Error ? error.message : 'Could not list call devices', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))
    const deviceId = normalizeId(body?.device_id)
    const publicKey = canonicalPublicKey(body?.public_key)
    const platform = body?.platform === 'ios' || body?.platform === 'android' ? body.platform : 'web'
    if (!deviceId || !publicKey) return errorResponse('device_id and public_key are required', 400)

    await registerCallDevice(createServiceClient(), {
      userId: user.id,
      deviceId,
      publicKey,
      platform,
    })
    return jsonResponse({ deviceId, registered: true })
  } catch (error) {
    const unauthorized = authError(error)
    if (unauthorized) return unauthorized
    const message = error instanceof Error ? error.message : 'Could not register call device'
    const status = /revoked|different key|Invalid/i.test(message) ? 409 : 400
    return errorResponse(message, status)
  }
}
