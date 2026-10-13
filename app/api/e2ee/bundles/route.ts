import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)
    const body = await request.json()
    const requested = Array.isArray(body.devices) ? body.devices.slice(0, 50) : []
    const serviceClient = createServiceClient()
    const bundles = []
    for (const item of requested) {
      const userId = typeof item?.user_id === 'string' ? item.user_id : ''
      const deviceId = Number(item?.device_id)
      if (!userId || !Number.isInteger(deviceId)) continue
      const { data: device } = await serviceClient
        .from('user_devices')
        .select(
          'user_id, device_id, registration_id, identity_key_public, signed_prekey_id, signed_prekey_public, signed_prekey_signature'
        )
        .eq('user_id', userId)
        .eq('device_id', deviceId)
        .is('revoked_at', null)
        .maybeSingle()
      if (!device) continue
      const { data: prekey, error: prekeyError } = await serviceClient.rpc('e2ee_consume_prekey', {
        p_user_id: userId,
        p_device_id: deviceId,
      })
      const oneTime = prekeyError ? null : Array.isArray(prekey) ? prekey[0] : prekey
      bundles.push({
        userId: device.user_id,
        deviceId: device.device_id,
        registrationId: device.registration_id,
        identityKey: device.identity_key_public,
        signedPreKey: {
          keyId: device.signed_prekey_id,
          publicKey: device.signed_prekey_public,
          signature: device.signed_prekey_signature,
        },
        ...(oneTime?.public_key
          ? { preKey: { keyId: oneTime.prekey_id, publicKey: oneTime.public_key } }
          : {}),
      })
    }
    return jsonResponse(bundles)
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Failed to create encryption sessions', 500)
  }
}
