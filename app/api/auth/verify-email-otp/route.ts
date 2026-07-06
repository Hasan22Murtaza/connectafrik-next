import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { createServiceClient } from '@/lib/supabase-server'
import {
  createVerificationToken,
  findAuthUserByEmail,
  verifyStoredEmailOtp,
} from '@/lib/auth/emailOtp'
import { isOtpPurpose } from '@/lib/auth/otpTypes'
import {
  confirmUserEmail,
  signInAndBuildResponse,
} from '@/lib/auth/completeRegistration'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    const purpose = body?.purpose
    const password = typeof body?.password === 'string' ? body.password : undefined

    if (!email || !token || !isOtpPurpose(purpose)) {
      return errorResponse('Email, token, and valid purpose are required', 400)
    }

    const serviceClient = createServiceClient()
    const verifyResult = await verifyStoredEmailOtp({
      serviceClient,
      email,
      code: token,
      purpose,
    })

    if (verifyResult.error) {
      const isExpired = verifyResult.error.toLowerCase().includes('expired')
      return errorResponse(verifyResult.error, isExpired ? 410 : 400)
    }

    if (purpose === 'signup') {
      const verificationToken = createVerificationToken({
        email,
        purpose,
        metadata: verifyResult.metadata,
      })

      return jsonResponse({
        verified: true,
        verificationToken,
        nextStep: 'create-password',
      })
    }

    if (purpose === 'recovery') {
      const user = await findAuthUserByEmail(serviceClient, email)
      if (!user) {
        return errorResponse('No account found with this email address.', 404)
      }

      const verificationToken = createVerificationToken({
        email,
        purpose,
      })

      return jsonResponse({
        verified: true,
        verificationToken,
        nextStep: 'create-password',
      })
    }

    // Login verification for unverified accounts
    const user = await findAuthUserByEmail(serviceClient, email)
    if (!user) {
      return errorResponse('No account found with this email address.', 404)
    }

    await confirmUserEmail(serviceClient, user.id)

    if (!password) {
      const verificationToken = createVerificationToken({
        email,
        purpose: 'login',
      })

      return jsonResponse({
        verified: true,
        verificationToken,
        nextStep: 'signin',
        emailVerified: true,
      })
    }

    const signInResult = await signInAndBuildResponse(serviceClient, email, password)
    return jsonResponse({
      verified: true,
      emailVerified: true,
      ...signInResult,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to verify OTP'
    return errorResponse(message, 500)
  }
}
