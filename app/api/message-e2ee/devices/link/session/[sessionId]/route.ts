import { NextRequest } from 'next/server'
import { getDeviceLinkSession } from '@/lib/message-e2ee/device-link'
import { DeviceLinkError, LINK_ERROR, humanLinkError } from '@/lib/message-e2ee/device-link-logic'
import { deviceLinkErrorResponse, jsonResponse, withDeviceLinkAuth } from '@/lib/message-e2ee/device-link-http'

type RouteContext = { params: Promise<{ sessionId: string }> }

/** GET /api/message-e2ee/devices/link/session/:sessionId */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user, service } = await withDeviceLinkAuth(request)
    const { sessionId: raw } = await context.params
    const sessionId = decodeURIComponent(raw || '').trim()
    if (!sessionId) {
      throw new DeviceLinkError(
        LINK_ERROR.LINK_SESSION_NOT_FOUND,
        humanLinkError(LINK_ERROR.LINK_SESSION_NOT_FOUND),
        404,
      )
    }
    const result = await getDeviceLinkSession(service, user.id, sessionId)
    return jsonResponse({
      sessionId: result.sessionId,
      status: result.status,
      deviceId: result.deviceId,
      expiresAt: result.expiresAt,
    })
  } catch (error) {
    return deviceLinkErrorResponse(error)
  }
}
