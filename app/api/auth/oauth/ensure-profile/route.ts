import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { ensureOAuthProfile } from '@/lib/auth/ensureOAuthProfile'

/**
 * POST /api/auth/oauth/ensure-profile
 * Ensures a CribsTalk profile exists after Google/Apple OAuth without duplicating rows
 * or overwriting existing profile fields.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const result = await ensureOAuthProfile(serviceClient, user)
    return jsonResponse(result)
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.message === 'Unauthorized' || error.message === 'Missing Authorization header')
    ) {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Failed to ensure profile'
    return errorResponse(message, 500)
  }
}
