import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ deviceId: string }> }

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { deviceId } = await context.params
    const parsed = Number(deviceId)
    if (!Number.isInteger(parsed) || parsed < 1) return errorResponse('Invalid device', 400)
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const now = new Date().toISOString()
    const { data, error } = await serviceClient
      .from('user_devices')
      .update({ revoked_at: now })
      .eq('user_id', user.id)
      .eq('device_id', parsed)
      .is('revoked_at', null)
      .select('device_id')
      .maybeSingle()
    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('Device not found', 404)
    await serviceClient.from('device_prekeys').delete().eq('user_id', user.id).eq('device_id', parsed)
    return jsonResponse({ device_id: parsed, revoked: true })
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Failed to remove device', 500)
  }
}
