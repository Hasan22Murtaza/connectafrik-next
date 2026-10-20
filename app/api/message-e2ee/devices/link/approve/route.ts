import { NextRequest } from 'next/server'
import { approveDeviceLinkSession, markDeviceLinkScanned } from '@/lib/message-e2ee/device-link'
import { DeviceLinkError, LINK_ERROR, humanLinkError } from '@/lib/message-e2ee/device-link-logic'
import { deviceLinkErrorResponse, jsonResponse, withDeviceLinkAuth } from '@/lib/message-e2ee/device-link-http'

/**
 * POST /api/message-e2ee/devices/link/approve
 * Server validates session + public keys. Cryptographic signing stays on the trusted client
 * (linkDeviceFromPayload → crypto_to_device). Call this after (or immediately before) that step.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, service } = await withDeviceLinkAuth(request)
    const body = await request.json().catch(() => ({}))
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : ''
    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.trim() : ''
    const publicKey = typeof body?.publicKey === 'string' ? body.publicKey.trim() : ''
    const approverDeviceId =
      (typeof body?.approverDeviceId === 'string' && body.approverDeviceId.trim()) ||
      request.headers.get('x-device-id')?.trim() ||
      ''

    if (!sessionId) {
      throw new DeviceLinkError(
        LINK_ERROR.LINK_SESSION_NOT_FOUND,
        humanLinkError(LINK_ERROR.LINK_SESSION_NOT_FOUND),
        404,
      )
    }
    if (!deviceId || !publicKey || !approverDeviceId) {
      throw new DeviceLinkError(LINK_ERROR.LINK_APPROVAL_FAILED, humanLinkError(LINK_ERROR.LINK_APPROVAL_FAILED), 400)
    }

    // Optional scanned-only transition for live UI before crypto finishes.
    if (body?.markScannedOnly === true || body?.markScanned === true) {
      const scanned = await markDeviceLinkScanned(service, user.id, sessionId)
      if (body?.markScannedOnly === true) {
        return jsonResponse(scanned)
      }
    }

    const result = await approveDeviceLinkSession(service, user.id, {
      sessionId,
      deviceId,
      publicKey,
      approverDeviceId,
    })
    return jsonResponse(result)
  } catch (error) {
    return deviceLinkErrorResponse(error)
  }
}
