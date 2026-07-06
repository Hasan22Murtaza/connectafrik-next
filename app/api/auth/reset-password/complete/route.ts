import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyVerificationToken, findAuthUserByEmail } from '@/lib/auth/emailOtp'
import { isPasswordValid } from '@/lib/auth/password'
import { completePasswordReset } from '@/lib/auth/completeRegistration'

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

    if (payload.purpose !== 'recovery') {
      return errorResponse('Invalid password reset session', 400)
    }

    const serviceClient = createServiceClient()
    const user = await findAuthUserByEmail(serviceClient, payload.email)

    if (!user) {
      return errorResponse('No account found with this email address.', 404)
    }

    const result = await completePasswordReset({
      serviceClient,
      userId: user.id,
      email: payload.email,
      password,
    })

    return jsonResponse(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reset password'
    return errorResponse(message, 500)
  }
}
