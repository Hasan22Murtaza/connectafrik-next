import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { getPostAuthRedirect } from '@/lib/auth/postAuthRedirect'
import { authLinkErrorQuery } from '@/lib/auth/parseAuthHash'
import { clearAuthCookiesOnResponse } from '@/lib/auth/supabaseAuthCookies'

type SessionCookie = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}

function getRedirectOrigin(request: NextRequest, fallbackOrigin: string): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'

  if (isLocalEnv || !forwardedHost) {
    return fallbackOrigin
  }

  const protocol = request.headers.get('x-forwarded-proto') ?? 'https'
  return `${protocol}://${forwardedHost}`
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const flow = searchParams.get('flow')
  const authError = searchParams.get('error')
  const authErrorCode = searchParams.get('error_code')
  let next = searchParams.get('redirect') ?? '/feed'

  if (!next.startsWith('/') || next.startsWith('//')) {
    next = '/feed'
  }

  const redirectOrigin = getRedirectOrigin(request, origin)

  if (!code) {
    if (authError || authErrorCode) {
      const errorQuery = authLinkErrorQuery(authErrorCode)
      return NextResponse.redirect(`${redirectOrigin}/signin?error=${errorQuery}`)
    }
    if (flow === 'signup') {
      return NextResponse.redirect(`${redirectOrigin}/signin?error=link_expired`)
    }
    return NextResponse.redirect(`${redirectOrigin}/signin?error=auth`)
  }

  try {
    let sessionCookies: SessionCookie[] = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            sessionCookies = cookiesToSet
          },
        },
      }
    )

    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      if (flow === 'signup') {
        return NextResponse.redirect(`${redirectOrigin}/signin?error=link_expired`)
      }
      return NextResponse.redirect(`${redirectOrigin}/signin?error=auth`)
    }

    if (flow === 'signup') {
      await supabase.auth.signOut()
      const redirectResponse = NextResponse.redirect(`${redirectOrigin}/account-activated`)
      clearAuthCookiesOnResponse(redirectResponse)
      return redirectResponse
    }

    let platformRole: string | null = null
    if (data.user?.id) {
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
    const redirectResponse = NextResponse.redirect(`${redirectOrigin}${next}`)

    for (const { name, value, options } of sessionCookies) {
      redirectResponse.cookies.set(name, value, options)
    }

    return redirectResponse
  } catch {
    return NextResponse.redirect(`${redirectOrigin}/signin?error=auth`)
  }
}
