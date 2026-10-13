import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { E2eeRequestError } from '@/lib/e2ee/server'
import { mapDeviceRow, registerDevice } from '@/lib/e2ee/deviceRecords'

function fail(error: unknown) {
  if (error instanceof E2eeRequestError) return errorResponse(error.message, error.status, { code: error.code })
  const message = error instanceof Error ? error.message : 'Encryption request failed'
  if (message === 'Unauthorized' || message === 'Missing Authorization header') return unauthorizedResponse()
  return errorResponse(message, 500)
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('user_devices')
      .select(
        'user_id, device_id, registration_id, device_name, identity_key_public, signed_prekey_id, signed_prekey_public, signed_prekey_signature, last_active_at, created_at'
      )
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .order('created_at', { ascending: true })
    if (error) return errorResponse(error.message, 400)
    const devices = []
    for (const row of data || []) {
      const { count } = await serviceClient
        .from('device_prekeys')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('device_id', row.device_id)
        .is('consumed_at', null)
      devices.push(mapDeviceRow({ ...row, prekeysRemaining: count || 0 }))
    }
    return jsonResponse({ devices })
  } catch (error) {
    return fail(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json()
    const deviceId = await registerDevice(serviceClient, user.id, body)
    return jsonResponse({ device_id: deviceId }, 201)
  } catch (error) {
    return fail(error)
  }
}
