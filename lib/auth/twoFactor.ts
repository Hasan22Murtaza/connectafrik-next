import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendOtpEmail } from '@/shared/services/emailService'
import { assertOtpSendAllowed, storeAndSendEmailOtp } from '@/lib/auth/emailOtp'

export function twoFactorRequiredResponse(email: string, message?: string) {
  return NextResponse.json(
    {
      success: false,
      data: { code: 'TWO_FACTOR_REQUIRED', email },
      message: message || 'Enter the verification code we sent to your email.',
    },
    { status: 403 }
  )
}

export async function revokeAuthSession(
  serviceClient: SupabaseClient,
  accessToken: string | null | undefined
) {
  if (!accessToken) return
  try {
    await serviceClient.auth.admin.signOut(accessToken, 'local')
  } catch {
    /* session may already be invalid */
  }
}

export async function sendTwoFactorOtp(
  serviceClient: SupabaseClient,
  email: string
): Promise<{ error: string | null; cooldown?: boolean }> {
  const rateLimit = await assertOtpSendAllowed(serviceClient, email, 'two_factor')
  if (rateLimit.error) {
    return { error: rateLimit.error, cooldown: Boolean(rateLimit.cooldownSeconds) }
  }

  const sendResult = await storeAndSendEmailOtp({
    serviceClient,
    email,
    purpose: 'two_factor',
    sendEmail: sendOtpEmail,
  })

  return { error: sendResult.error }
}
