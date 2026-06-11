import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { clearAuthCookiesOnResponse } from '@/lib/auth/supabaseAuthCookies'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const code = typeof body?.code === 'string' ? body.code.trim() : ''

    if (!code) {
      return errorResponse('Confirmation code is required', 400)
    }

    const cookieStore = await cookies()
    let response = jsonResponse({ ok: true })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            response = jsonResponse({ ok: true })
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return errorResponse(error.message, 400)
    }

    await supabase.auth.signOut()
    clearAuthCookiesOnResponse(response)
    return response
  } catch (error: any) {
    return errorResponse(error?.message || 'Failed to confirm signup', 500)
  }
}
