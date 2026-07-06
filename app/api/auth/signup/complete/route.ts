import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyVerificationToken, isSignupProfileMetadata } from '@/lib/auth/emailOtp'
import { isPasswordValid } from '@/lib/auth/password'
import { completeSignupRegistration } from '@/lib/auth/completeRegistration'
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const verificationToken =
      typeof body?.verificationToken === 'string' ? body.verificationToken : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!verificationToken || !password) {
      return errorResponse('Verification token and password are required', 400)
    }

    if (!isPasswordValid(password)) {
      return errorResponse('Password does not meet all requirements', 400)
    }

    let payload
    try {
      payload = verifyVerificationToken(verificationToken)
    } catch {
      return errorResponse('Verification session has expired. Please start again.', 410)
    }

    if (payload.purpose !== 'signup' || !isSignupProfileMetadata(payload.metadata)) {
      return errorResponse('Invalid signup verification session', 400)
    }

    const serviceClient = createServiceClient()
    const result = await completeSignupRegistration({
      serviceClient,
      email: payload.email,
      password,
      metadata: payload.metadata,
    })

    return jsonResponse(result, 201)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to complete signup'
    if (message.toLowerCase().includes('already registered')) {
      return errorResponse('An account with this email already exists. Please sign in instead.', 409)
    }
    return errorResponse(message, 500)
  }
}
