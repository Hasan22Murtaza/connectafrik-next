import { NextRequest } from 'next/server'
import { revokeLinkedCryptoDevice } from '@/lib/message-e2ee/device-link'
import { deviceLinkErrorResponse, jsonResponse, withDeviceLinkAuth } from '@/lib/message-e2ee/device-link-http'

type RouteContext = { params: Promise<{ deviceId: string }> }

/** DELETE /api/message-e2ee/devices/:deviceId — revoke a crypto device (keys + OTKs). */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { user, service } = await withDeviceLinkAuth(request)
    const { deviceId: rawId } = await context.params
    const deviceId = decodeURIComponent(rawId || '').trim()
    let requesterDeviceId: string | undefined
    try {
      const body = await request.json()
      if (typeof body?.requesterDeviceId === 'string') requesterDeviceId = body.requesterDeviceId.trim()
      if (typeof body?.deviceId === 'string' && !requesterDeviceId) {
        requesterDeviceId = body.deviceId.trim()
      }
    } catch {
      // empty body is fine
    }
    const headerDevice = request.headers.get('x-device-id')?.trim()
    if (!requesterDeviceId && headerDevice) requesterDeviceId = headerDevice

    const result = await revokeLinkedCryptoDevice(service, user.id, deviceId, requesterDeviceId)
    return jsonResponse(result)
  } catch (error) {
    return deviceLinkErrorResponse(error)
  }
}
