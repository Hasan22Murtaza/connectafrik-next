import { NextRequest } from 'next/server'
import { listLinkedCryptoDevices } from '@/lib/message-e2ee/device-link'
import { deviceLinkErrorResponse, jsonResponse, withDeviceLinkAuth } from '@/lib/message-e2ee/device-link-http'

/** GET /api/message-e2ee/devices — list this user's crypto devices (public metadata only). */
export async function GET(request: NextRequest) {
  try {
    const { user, service } = await withDeviceLinkAuth(request)
    const currentDeviceId = request.nextUrl.searchParams.get('device_id')?.trim() || undefined
    const result = await listLinkedCryptoDevices(service, user.id, currentDeviceId)
    return jsonResponse(result)
  } catch (error) {
    return deviceLinkErrorResponse(error)
  }
}
