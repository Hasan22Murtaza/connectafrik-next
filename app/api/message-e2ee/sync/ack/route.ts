import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { isMessageE2eeEnabledForUser } from '@/lib/message-e2ee/flag'
import { ackMessageCryptoSync } from '@/lib/message-e2ee/broker'

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    if (!isMessageE2eeEnabledForUser(user.id)) {
      return errorResponse('End-to-end encryption is not enabled for this account', 403)
    }
    const body = await request.json()
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === 'string') : []
    const result = await ackMessageCryptoSync(createServiceClient(), user.id, ids)
    return jsonResponse(result)
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Failed to acknowledge encryption events', 500)
  }
}
