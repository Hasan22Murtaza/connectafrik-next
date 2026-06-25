import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { createServiceClient } from '@/lib/supabase-server'
import { sendSignupConfirmationEmail } from '@/shared/services/emailService'
import { deepLinkConfig } from '@/lib/deeplink/config'
import { isRecord } from '../_shared'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const metadata = isRecord(body?.metadata) ? body.metadata : undefined

    if (!email || !password) {
      return errorResponse('Email and password are required', 400)
    }

    // Use the canonical deep-link base URL so the activation link is a Universal
    // / App Link that opens the native app when installed.
    const redirectTo = `${deepLinkConfig.webBaseUrl}/confirm-signup`
    const serviceClient = createServiceClient()

    const { data, error } = await serviceClient.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo,
        ...(metadata ? { data: metadata } : {}),
      },
    })

    if (error) {
      return errorResponse(error.message, 400)
    }

    const confirmationUrl = data?.properties?.action_link
    if (!confirmationUrl) {
      return errorResponse('Failed to generate confirmation link', 500)
    }

    const emailSent = await sendSignupConfirmationEmail(email, confirmationUrl)
    if (!emailSent) {
      return errorResponse(
        'Account created but failed to send confirmation email. Please contact support.',
        500
      )
    }

    return jsonResponse(
      {
        user: data.user,
        session: null,
        emailSent: true,
      },
      201
    )
  } catch (error: any) {
    return errorResponse(error?.message || 'Failed to sign up', 500)
  }
}
