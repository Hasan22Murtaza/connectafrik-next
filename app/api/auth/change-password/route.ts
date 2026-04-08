import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthenticatedUser,
  getAccessTokenFromRequest,
  updateUserPasswordViaGotrue,
} from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const MIN_PASSWORD_LEN = 8

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)

    const email = user.email?.trim()
    const hasEmailPasswordIdentity = user.identities?.some((i) => i.provider === 'email') ?? false

    if (!email || !hasEmailPasswordIdentity) {
      return errorResponse(
        'Password change is only available for accounts that signed up with email and password.',
        400
      )
    }

    const body = await request.json()
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

    if (!currentPassword || !newPassword) {
      return errorResponse('Current password and new password are required', 400)
    }

    if (newPassword.length < MIN_PASSWORD_LEN) {
      return errorResponse(`New password must be at least ${MIN_PASSWORD_LEN} characters`, 400)
    }

    if (newPassword === currentPassword) {
      return errorResponse('New password must be different from your current password', 400)
    }

    const anon = createClient(supabaseUrl, supabaseAnonKey)
    const { error: credError } = await anon.auth.signInWithPassword({
      email,
      password: currentPassword,
    })

    if (credError) {
      return errorResponse('Current password is incorrect', 401)
    }

    const accessToken = getAccessTokenFromRequest(request)
    if (!accessToken) {
      return unauthorizedResponse()
    }

    const { error: updateError } = await updateUserPasswordViaGotrue(accessToken, newPassword)

    if (updateError) {
      return errorResponse(updateError, 400)
    }

    return jsonResponse({ updated: true })
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.message === 'Unauthorized' || err.message === 'Missing Authorization header')
    ) {
      return unauthorizedResponse()
    }
    const message = err instanceof Error ? err.message : 'Failed to change password'
    return errorResponse(message, 500)
  }
}
