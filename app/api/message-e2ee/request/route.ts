import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { isMessageE2eeEnabledForUser } from '@/lib/message-e2ee/flag'
import { handleMessageCryptoRequest, messageCryptoReady } from '@/lib/message-e2ee/broker'

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    if (!isMessageE2eeEnabledForUser(user.id)) {
      return errorResponse('End-to-end encryption is not enabled for this account', 403)
    }
    const service = createServiceClient()
    if (!(await messageCryptoReady(service))) {
      return errorResponse('Message encryption is not available until the database migration is applied.', 503)
    }
    const body = await request.json()
    const result = await handleMessageCryptoRequest(service, user.id, {
      type: body?.type,
      body: body?.body,
      deviceId: typeof body?.deviceId === 'string' ? body.deviceId : undefined,
    })
    return jsonResponse(result)
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    const message = error?.message || 'Encryption request failed'
    const status = /do not belong|empty|could not be read|required/i.test(message) ? 400 : 500
    return errorResponse(message, status)
  }
}
