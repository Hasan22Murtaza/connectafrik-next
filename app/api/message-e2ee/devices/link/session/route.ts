import { NextRequest } from 'next/server'
import { createDeviceLinkSession } from '@/lib/message-e2ee/device-link'
import { DeviceLinkError, LINK_ERROR, humanLinkError } from '@/lib/message-e2ee/device-link-logic'
import { deviceLinkErrorResponse, jsonResponse, withDeviceLinkAuth } from '@/lib/message-e2ee/device-link-http'

/** POST /api/message-e2ee/devices/link/session — create a short-lived linking session. */
export async function POST(request: NextRequest) {
  try {
    const { user, service } = await withDeviceLinkAuth(request)
    const body = await request.json().catch(() => ({}))
    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.trim() : ''
    if (!deviceId) {
      throw new DeviceLinkError(LINK_ERROR.DEVICE_NOT_FOUND, humanLinkError(LINK_ERROR.DEVICE_NOT_FOUND), 400)
    }
    const result = await createDeviceLinkSession(service, user.id, {
      deviceId,
      deviceType: typeof body?.deviceType === 'string' ? body.deviceType : undefined,
      platform: typeof body?.platform === 'string' ? body.platform : undefined,
      deviceName: typeof body?.deviceName === 'string' ? body.deviceName : undefined,
      publicKey: typeof body?.publicKey === 'string' ? body.publicKey : undefined,
    })
    return jsonResponse(result)
  } catch (error) {
    return deviceLinkErrorResponse(error)
  }
}
