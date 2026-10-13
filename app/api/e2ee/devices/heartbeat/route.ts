import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const body = await request.json()
    const deviceId = Number(body.device_id)
    if (!Number.isInteger(deviceId) || deviceId < 1) return errorResponse('Invalid device', 400)
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('user_devices')
      .update({ last_active_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
      .is('revoked_at', null)
      .select('device_id')
      .maybeSingle()
    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('Device not found', 404)
    return jsonResponse({ ok: true })
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Failed to update device', 500)
  }
}
