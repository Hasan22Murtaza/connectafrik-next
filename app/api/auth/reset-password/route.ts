import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { createAuthClient } from '../_shared'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const redirectToFromBody =
      typeof body?.redirectTo === 'string' ? body.redirectTo.trim() : ''
    const redirectTo = redirectToFromBody || `${request.nextUrl.origin}/reset-password`

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
