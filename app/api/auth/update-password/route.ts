import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { createAuthenticatedClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!password) {
      return errorResponse('Password is required', 400)
    }

    const supabase = createAuthenticatedClient(request)
    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({ updated: true })
  } catch (error: any) {
    if (
      error?.message === 'Missing Authorization header' ||
      error?.message === 'Unauthorized'
    ) {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Failed to update password', 500)
  }
}
