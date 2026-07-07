import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  let next = url.searchParams.get('redirect') ?? '/feed'

  if (!next.startsWith('/') || next.startsWith('//')) {
    next = '/feed'
  }

  const signinError = () =>
    NextResponse.redirect(`${url.origin}/signin?error=auth`)

  if (!code) {
    return signinError()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return signinError()
  }

  const response = NextResponse.redirect(`${url.origin}${next}`)

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return signinError()
    }
  } catch {
    return signinError()
  }

  return response
}
