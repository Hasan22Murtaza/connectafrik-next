import { NextRequest } from 'next/server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { isMessageE2eeEnabledForUser } from '@/lib/message-e2ee/flag'
import { messageCryptoReady } from '@/lib/message-e2ee/broker'
import { DeviceLinkError, LINK_ERROR, humanLinkError } from '@/lib/message-e2ee/device-link-logic'

export async function withDeviceLinkAuth(request: NextRequest) {
  const { user } = await getAuthenticatedUser(request)
  if (!isMessageE2eeEnabledForUser(user.id)) {
    throw new DeviceLinkError(
      LINK_ERROR.DEVICE_NOT_AUTHORIZED,
      'End-to-end encryption is not enabled for this account',
      403,
    )
  }
  const service = createServiceClient()
  if (!(await messageCryptoReady(service))) {
    throw new Error('Message encryption is not available until the database migration is applied.')
  }
  return { user, service }
}

export function deviceLinkErrorResponse(error: unknown) {
  if (error instanceof DeviceLinkError) {
    return errorResponse(error.message, error.httpStatus, { code: error.code })
  }
  if (error instanceof Error) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    if (error.message === 'RATE_LIMITED') {
      return errorResponse(humanLinkError(LINK_ERROR.RATE_LIMITED), 429, { code: LINK_ERROR.RATE_LIMITED })
    }
    if (/migration|not available/i.test(error.message)) {
      return errorResponse(error.message, 503)
    }
    return errorResponse(error.message || 'Device linking failed', 500)
  }
  return errorResponse('Device linking failed', 500)
}

export { jsonResponse }
