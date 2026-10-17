import { NextRequest } from 'next/server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { CALL_E2EE_JOIN_ERROR } from '@/lib/call-e2ee/protocol'
import { normalizeId, readOwnSealedCallKey } from '@/lib/call-e2ee/persist'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const callId = request.nextUrl.searchParams.get('call_id')?.trim() || ''
    const deviceId = normalizeId(request.nextUrl.searchParams.get('device_id'))
    if (!callId || !deviceId) return errorResponse('call_id and device_id are required', 400)

    const key = await readOwnSealedCallKey(createServiceClient(), {
      userId: user.id,
      callId,
      deviceId,
    })
    if (!key) return errorResponse(CALL_E2EE_JOIN_ERROR, 404)
    return jsonResponse(key)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'Unauthorized' || message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(CALL_E2EE_JOIN_ERROR, 500)
  }
}
