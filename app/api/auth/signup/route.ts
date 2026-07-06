import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { createServiceClient } from '@/lib/supabase-server'
import { sendOtpEmail } from '@/shared/services/emailService'
import {
  assertOtpSendAllowed,
  findAuthUserByEmail,
  isSignupProfileMetadata,
  storeAndSendEmailOtp,
} from '@/lib/auth/emailOtp'
import { isRecord } from '../_shared'

/**
 * Initiate email signup: validate profile metadata and send a 6-digit OTP.
 * Account creation completes after OTP verification and password setup.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const metadata = isRecord(body?.metadata) ? body.metadata : undefined

    if (!email) {
      return errorResponse('Email is required', 400)
    }

    if (!isSignupProfileMetadata(metadata)) {
      return errorResponse('Signup profile information is required', 400)
    }

    const serviceClient = createServiceClient()
    const existingUser = await findAuthUserByEmail(serviceClient, email)

    if (existingUser) {
      return errorResponse('An account with this email already exists. Please sign in instead.', 409)
    }

    const { data: usernameConflict } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('username', metadata.username)
      .maybeSingle()

    if (usernameConflict) {
      return errorResponse('This username is already taken. Please choose another.', 409)
    }

    const rateLimit = await assertOtpSendAllowed(serviceClient, email, 'signup')
    if (rateLimit.error) {
      return errorResponse(rateLimit.error, 429)
    }

    const sendResult = await storeAndSendEmailOtp({
      serviceClient,
      email,
      purpose: 'signup',
      metadata,
      sendEmail: sendOtpEmail,
    })

    if (sendResult.error) {
      return errorResponse(sendResult.error, 500)
    }

    return jsonResponse({ sent: true, cooldownSeconds: 60 }, 201)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to initiate signup'
    return errorResponse(message, 500)
  }
}
