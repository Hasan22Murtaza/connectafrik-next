import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { isMessageE2eeEnabledForUser } from '@/lib/message-e2ee/flag'
import { messageCryptoReady } from '@/lib/message-e2ee/broker'

/**
 * `enabled` = rollout flag (MESSAGE_E2EE) for this user.
 * `ready` = crypto tables reachable (migrations applied).
 * Clients must not treat `ready: false` as "feature off" — the rollout flag
 * can still be on while key publish waits for migrations.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const enabled = isMessageE2eeEnabledForUser(user.id)
    if (!enabled) {
      return jsonResponse({ enabled: false, ready: false })
    }
    const ready = await messageCryptoReady(createServiceClient())
    return jsonResponse({ enabled: true, ready })
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Failed to read encryption status', 500)
  }
}
