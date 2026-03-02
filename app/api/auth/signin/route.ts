import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { createAuthClient } from '../_shared'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!email || !password) {
      return errorResponse('Email and password are required', 400)
    }

    const supabase = createAuthClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({
      user: data.user,
      session: data.session,
    })
  } catch (error: any) {
    return errorResponse(error?.message || 'Failed to sign in', 500)
  }
}
