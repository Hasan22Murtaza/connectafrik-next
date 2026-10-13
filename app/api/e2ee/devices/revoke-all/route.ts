import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const now = new Date().toISOString()
    const { error } = await serviceClient
      .from('user_devices')
      .update({ revoked_at: now })
      .eq('user_id', user.id)
      .is('revoked_at', null)
    if (error) return errorResponse(error.message, 400)
    await serviceClient.from('device_prekeys').delete().eq('user_id', user.id)
    return jsonResponse({ revoked: true })
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Failed to remove devices', 500)
  }
}
