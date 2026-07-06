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
import { isOtpPurpose } from '@/lib/auth/otpTypes'
import { isRecord } from '../_shared'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const purpose = body?.purpose
    const metadata = isRecord(body?.metadata) ? body.metadata : undefined

    if (!email || !isOtpPurpose(purpose)) {
      return errorResponse('Email and valid purpose are required', 400)
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
      return errorResponse('Please enter a valid email address', 400)
    }

    const serviceClient = createServiceClient()
    const existingUser = await findAuthUserByEmail(serviceClient, email)

    if (purpose === 'signup') {
      if (existingUser) {
        return errorResponse('An account with this email already exists. Please sign in instead.', 409)
      }
      if (!isSignupProfileMetadata(metadata)) {
        return errorResponse('Signup profile information is required', 400)
      }

      const { data: usernameConflict } = await serviceClient
        .from('profiles')
        .select('id')
        .eq('username', metadata.username)
        .maybeSingle()

      if (usernameConflict) {
        return errorResponse('This username is already taken. Please choose another.', 409)
      }
    }

    if (purpose === 'login' || purpose === 'recovery') {
      if (!existingUser) {
        return errorResponse('No account found with this email address.', 404)
      }
    }

    const rateLimit = await assertOtpSendAllowed(serviceClient, email, purpose)
    if (rateLimit.error) {
      return errorResponse(rateLimit.error, 429)
    }

    const sendResult = await storeAndSendEmailOtp({
      serviceClient,
      email,
      purpose,
      metadata: isSignupProfileMetadata(metadata) ? metadata : undefined,
      sendEmail: sendOtpEmail,
    })

    if (sendResult.error) {
      return errorResponse(sendResult.error, 500)
    }

    return jsonResponse({ sent: true, cooldownSeconds: 60 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send OTP'
    return errorResponse(message, 500)
  }
}
