import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { isMessageE2eeEnabledForUser } from '@/lib/message-e2ee/flag'
import { pullMessageCryptoSync } from '@/lib/message-e2ee/broker'

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    if (!isMessageE2eeEnabledForUser(user.id)) {
      return errorResponse('End-to-end encryption is not enabled for this account', 403)
    }
    const deviceId = request.nextUrl.searchParams.get('device_id')?.trim() || ''
    if (!/^[A-Za-z0-9]{8,64}$/.test(deviceId)) {
      return errorResponse('Device id is required', 400)
    }
    const result = await pullMessageCryptoSync(createServiceClient(), user.id, deviceId)
    return jsonResponse(result)
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    const message = error?.message || 'Failed to sync encryption events'
    const status = /not published/i.test(message) ? 404 : 500
    return errorResponse(message, status)
  }
}
