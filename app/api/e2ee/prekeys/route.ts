import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { isSignalPublicKey } from '@/lib/e2ee/bytes'

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const body = await request.json()
    const deviceId = Number(body.device_id)
    const prekeys = Array.isArray(body.prekeys) ? body.prekeys : []
    if (!Number.isInteger(deviceId) || prekeys.length < 1 || prekeys.length > 100) {
      return errorResponse('Invalid prekeys', 400, { code: 'E2EE_INVALID' })
    }
    const serviceClient = createServiceClient()
    const { data: device } = await serviceClient
      .from('user_devices')
      .select('device_id')
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
      .is('revoked_at', null)
      .maybeSingle()
    if (!device) return errorResponse('Device not found', 404)
    const rows: Array<{ keyId: number; publicKey: string }> = prekeys.map((prekey: { key_id?: number; public_key?: string }) => {
      const keyId = Number(prekey.key_id)
      const publicKey = prekey.public_key || ''
      if (!Number.isInteger(keyId) || keyId < 1 || !isSignalPublicKey(publicKey)) {
        throw new Error('Invalid one-time prekey')
      }
      return { keyId, publicKey }
    })
    const { error } = await serviceClient.from('device_prekeys').upsert(
      rows.map((row) => ({
        user_id: user.id,
        device_id: deviceId,
        prekey_id: row.keyId,
        public_key: row.publicKey,
      })),
      { onConflict: 'user_id,device_id,prekey_id', ignoreDuplicates: true }
    )
    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ uploaded: rows.length })
  } catch (error: any) {
    if (error?.message === 'Invalid one-time prekey') {
      return errorResponse(error.message, 400, { code: 'E2EE_INVALID' })
    }
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Failed to upload prekeys', 500)
  }
}
