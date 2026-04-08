import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  getAuthenticatedUser,
  getAccessTokenFromRequest,
  updateUserPasswordViaGotrue,
} from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)

    const body = await request.json()
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!password) {
      return errorResponse('Password is required', 400)
    }

    const accessToken = getAccessTokenFromRequest(request)
    if (!accessToken) {
      return unauthorizedResponse()
    }

    const { error } = await updateUserPasswordViaGotrue(accessToken, password)

    if (error) {
      return errorResponse(error, 400)
    }

    return jsonResponse({ updated: true })
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.message === 'Missing Authorization header' || error.message === 'Unauthorized')
    ) {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Failed to update password'
    return errorResponse(message, 500)
  }
}
