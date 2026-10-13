import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { assertPublicKeyMaterial, E2eeRequestError } from '@/lib/e2ee/server'

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const body = await request.json()
    const deviceId = Number(body.device_id)
    const signed = body.signed_prekey || {}
    const serviceClient = createServiceClient()
    const { data: device } = await serviceClient
      .from('user_devices')
      .select('identity_key_public')
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
      .is('revoked_at', null)
      .maybeSingle()
    if (!device) return errorResponse('Device not found', 404)
    assertPublicKeyMaterial({
      identityKey: device.identity_key_public,
      signedPublic: signed.public_key || '',
      signature: signed.signature || '',
      preKeys: [],
    })
    const keyId = Number(signed.key_id)
    if (!Number.isInteger(keyId) || keyId < 1) {
      throw new E2eeRequestError('Invalid signed prekey', 400, 'E2EE_INVALID')
    }
    const { error } = await serviceClient
      .from('user_devices')
      .update({
        signed_prekey_id: keyId,
        signed_prekey_public: signed.public_key,
        signed_prekey_signature: signed.signature,
        signed_prekey_rotated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ key_id: keyId })
  } catch (error) {
    if (error instanceof E2eeRequestError) return errorResponse(error.message, error.status, { code: error.code })
    const message = error instanceof Error ? error.message : 'Failed to rotate signed prekey'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(message, 500)
  }
}
