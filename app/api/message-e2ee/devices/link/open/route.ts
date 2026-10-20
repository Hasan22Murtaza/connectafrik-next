import { NextRequest } from 'next/server'
import { findOpenLinkSessionForDevice } from '@/lib/message-e2ee/device-link'
import { DeviceLinkError, LINK_ERROR, humanLinkError } from '@/lib/message-e2ee/device-link-logic'
import { deviceLinkErrorResponse, jsonResponse, withDeviceLinkAuth } from '@/lib/message-e2ee/device-link-http'

/**
 * GET /api/message-e2ee/devices/link/open?device_id=…
 * Locate the open link session for a target device (owner paste / QR flow without session id in payload).
 */
export async function GET(request: NextRequest) {
  try {
    const { user, service } = await withDeviceLinkAuth(request)
    const deviceId = request.nextUrl.searchParams.get('device_id')?.trim() || ''
    if (!deviceId) {
      throw new DeviceLinkError(LINK_ERROR.DEVICE_NOT_FOUND, humanLinkError(LINK_ERROR.DEVICE_NOT_FOUND), 400)
    }
    const open = await findOpenLinkSessionForDevice(service, user.id, deviceId)
    return jsonResponse(open)
  } catch (error) {
    return deviceLinkErrorResponse(error)
  }
}
