import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { createAuthClient, isRecord } from '../_shared'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
    const metadata = isRecord(body?.data) ? body.data : undefined

    if (!phone) {
      return errorResponse('Phone number is required', 400)
    }

    const supabase = createAuthClient()
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: metadata
        ? {
            data: metadata,
          }
        : undefined,
    })

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({ sent: true })
  } catch (error: any) {
    return errorResponse(error?.message || 'Failed to send OTP', 500)
  }
}
