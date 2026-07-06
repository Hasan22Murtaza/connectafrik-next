import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { createServiceClient } from '@/lib/supabase-server'
import { sendOtpEmail } from '@/shared/services/emailService'
import {
  assertOtpSendAllowed,
  findAuthUserByEmail,
  storeAndSendEmailOtp,
} from '@/lib/auth/emailOtp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email) {
      return errorResponse('Email is required', 400)
    }

    const serviceClient = createServiceClient()
    const existingUser = await findAuthUserByEmail(serviceClient, email)

    if (!existingUser) {
      return errorResponse('No account found with this email address.', 404)
    }

    const rateLimit = await assertOtpSendAllowed(serviceClient, email, 'recovery')
    if (rateLimit.error) {
      return errorResponse(rateLimit.error, 429)
    }

    const sendResult = await storeAndSendEmailOtp({
      serviceClient,
      email,
      purpose: 'recovery',
      sendEmail: sendOtpEmail,
    })

    if (sendResult.error) {
      return errorResponse(sendResult.error, 500)
    }

    return jsonResponse({ sent: true, cooldownSeconds: 60 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to request password reset'
    return errorResponse(message, 500)
  }
}
