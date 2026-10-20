import { NextRequest } from 'next/server'
import { completeDeviceLinkSession } from '@/lib/message-e2ee/device-link'
import { DeviceLinkError, LINK_ERROR, humanLinkError } from '@/lib/message-e2ee/device-link-logic'
import { deviceLinkErrorResponse, jsonResponse, withDeviceLinkAuth } from '@/lib/message-e2ee/device-link-http'

/** POST /api/message-e2ee/devices/link/complete — finalize after encrypted bootstrap is applied locally. */
export async function POST(request: NextRequest) {
  try {
    const { user, service } = await withDeviceLinkAuth(request)
    const body = await request.json().catch(() => ({}))
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : ''
    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.trim() : ''
    if (!sessionId || !deviceId) {
      throw new DeviceLinkError(
        LINK_ERROR.LINK_COMPLETION_FAILED,
        humanLinkError(LINK_ERROR.LINK_COMPLETION_FAILED),
        400,
      )
    }
    const result = await completeDeviceLinkSession(service, user.id, { sessionId, deviceId })
    return jsonResponse(result)
  } catch (error) {
    return deviceLinkErrorResponse(error)
  }
}
