import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { deepLinkConfig } from '@/lib/deeplink/config'
import { createAuthClient } from '../_shared'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    // Always use our canonical deep-link base URL. We intentionally ignore any
    // client-supplied redirect to prevent the reset email from pointing at an
    // attacker-controlled host. This is also a Universal / App Link, so it opens
    // the native app when installed.
    const redirectTo = `${deepLinkConfig.webBaseUrl}/reset-password`

    if (!email) {
      return errorResponse('Email is required', 400)
    }

    const supabase = createAuthClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({ sent: true })
  } catch (error: any) {
    return errorResponse(error?.message || 'Failed to request password reset', 500)
  }
}
