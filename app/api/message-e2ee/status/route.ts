import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { isMessageE2eeEnabledForUser } from '@/lib/message-e2ee/flag'
import { messageCryptoReady } from '@/lib/message-e2ee/broker'

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    if (!isMessageE2eeEnabledForUser(user.id)) {
      return jsonResponse({ enabled: false })
    }
    const ready = await messageCryptoReady(createServiceClient())
    return jsonResponse({ enabled: ready })
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Failed to read encryption status', 500)
  }
}
