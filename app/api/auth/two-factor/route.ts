import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { verifyStoredEmailOtp } from '@/lib/auth/emailOtp'
import { sendTwoFactorOtp } from '@/lib/auth/twoFactor'

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const body = await request.json()
    const enabled = body?.enabled
    const code = typeof body?.code === 'string' ? body.code.trim() : ''

    if (typeof enabled !== 'boolean') {
      return errorResponse('enabled is required', 400)
    }

    const serviceClient = createServiceClient()
    const now = new Date().toISOString()

    const email = user.email?.trim().toLowerCase()
    if (!email) {
      return errorResponse('Add an email address to manage two-factor authentication.', 400)
    }

    // Enabling and disabling both require a fresh OTP (step-up).
    if (!code) {
      const otp = await sendTwoFactorOtp(serviceClient, email)
      if (otp.error) {
        return errorResponse(otp.error, otp.cooldown ? 429 : 500)
      }
      return jsonResponse({
        otp_sent: true,
        two_factor_enabled: enabled ? false : true,
        pending_action: enabled ? 'enable' : 'disable',
      })
    }

    const verifyResult = await verifyStoredEmailOtp({
      serviceClient,
      email,
      code,
      purpose: 'two_factor',
    })

    if (verifyResult.error) {
      const isExpired = verifyResult.error.toLowerCase().includes('expired')
      return errorResponse(verifyResult.error, isExpired ? 410 : 400)
    }

    const { error } = await serviceClient
      .from('profiles')
      .update({ two_factor_enabled: enabled, updated_at: now })
      .eq('id', user.id)

    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ two_factor_enabled: enabled })
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.message === 'Unauthorized' || error.message === 'Missing Authorization header')
    ) {
      return unauthorizedResponse()
    }
    const message = error instanceof Error ? error.message : 'Failed to update two-factor authentication'
    return errorResponse(message, 500)
  }
}
