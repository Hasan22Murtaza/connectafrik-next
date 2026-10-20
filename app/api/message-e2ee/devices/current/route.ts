import { NextRequest } from 'next/server'
import { getCurrentCryptoDevice } from '@/lib/message-e2ee/device-link'
import { DeviceLinkError, LINK_ERROR, humanLinkError } from '@/lib/message-e2ee/device-link-logic'
import { deviceLinkErrorResponse, jsonResponse, withDeviceLinkAuth } from '@/lib/message-e2ee/device-link-http'

/** GET /api/message-e2ee/devices/current?device_id=… */
export async function GET(request: NextRequest) {
  try {
    const { user, service } = await withDeviceLinkAuth(request)
    const deviceId = request.nextUrl.searchParams.get('device_id')?.trim() || ''
    if (!deviceId) {
      throw new DeviceLinkError(LINK_ERROR.DEVICE_NOT_FOUND, humanLinkError(LINK_ERROR.DEVICE_NOT_FOUND), 400)
    }
    const result = await getCurrentCryptoDevice(service, user.id, deviceId)
    return jsonResponse(result)
  } catch (error) {
    return deviceLinkErrorResponse(error)
  }
}
