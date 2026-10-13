import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { E2eeRequestError } from '@/lib/e2ee/server'
import { restoreDevice } from '@/lib/e2ee/deviceRecords'

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const deviceId = await restoreDevice(createServiceClient(), user.id, await request.json())
    return jsonResponse({ device_id: deviceId })
  } catch (error) {
    if (error instanceof E2eeRequestError) return errorResponse(error.message, error.status, { code: error.code })
    const message = error instanceof Error ? error.message : 'Failed to restore device'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(message, 500)
  }
}
