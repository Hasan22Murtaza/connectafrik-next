import { NextRequest } from 'next/server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import { isCallE2eeEnabledForUser } from '@/lib/call-e2ee/flag'
import { getAuthenticatedUser } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    return jsonResponse({ enabled: isCallE2eeEnabledForUser(user.id) })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse('Could not read call encryption status', 500)
  }
}
