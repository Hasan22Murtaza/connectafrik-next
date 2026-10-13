import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { mapDeviceRow } from '@/lib/e2ee/deviceRecords'

const DEVICE_SELECT =
  'user_id, device_id, registration_id, device_name, identity_key_public, signed_prekey_id, signed_prekey_public, signed_prekey_signature, last_active_at, created_at'

export async function GET(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)
    const raw = request.nextUrl.searchParams.get('user_ids') || ''
    const userIds = [...new Set(raw.split(',').map((id) => id.trim()).filter(Boolean))].slice(0, 50)
    if (userIds.length === 0) return jsonResponse([])
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('user_devices')
      .select(DEVICE_SELECT)
      .in('user_id', userIds)
      .is('revoked_at', null)
    if (error) return errorResponse(error.message, 400)
    return jsonResponse((data || []).map((row) => mapDeviceRow(row)))
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Failed to load encryption devices', 500)
  }
}
