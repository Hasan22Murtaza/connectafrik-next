import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { maybeSendLoginAlert } from '@/lib/auth/loginAlerts'

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    await maybeSendLoginAlert({
      serviceClient,
      userId: user.id,
      email: user.email,
      request,
    })
    return jsonResponse({ sent: true })
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.message === 'Unauthorized' || error.message === 'Missing Authorization header')
    ) {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Failed to send login alert'
    return errorResponse(message, 500)
  }
}
