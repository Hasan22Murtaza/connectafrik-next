import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { createAuthClient } from '../_shared'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    const type = body?.type === 'phone_change' ? 'phone_change' : 'sms'

    if (!phone || !token) {
      return errorResponse('Phone number and token are required', 400)
    }

    const supabase = createAuthClient()
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type,
    })

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({
      user: data.user,
      session: data.session,
    })
  } catch (error: any) {
    return errorResponse(error?.message || 'Failed to verify OTP', 500)
  }
}
