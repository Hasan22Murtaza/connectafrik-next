import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { getPostAuthRedirect } from '@/lib/auth/postAuthRedirect'

export const runtime = 'nodejs'

type SessionCookie = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}

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

  let sessionCookies: SessionCookie[] = []

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        sessionCookies = cookiesToSet
      },
    },
  })

  try {
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return signinError()
    }

    let platformRole: string | null = null
    if (data.user?.id && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const serviceClient = createServiceClient()
        const { data: profile } = await serviceClient
          .from('profiles')
          .select('platform_role')
          .eq('id', data.user.id)
          .maybeSingle()
        platformRole = profile?.platform_role ?? null
      } catch {
        platformRole = null
      }
    }

    next = getPostAuthRedirect(platformRole, next)
    const response = NextResponse.redirect(`${url.origin}${next}`)

    for (const { name, value, options } of sessionCookies) {
      response.cookies.set(name, value, options)
    }

    return response
  } catch {
    return signinError()
  }
}
