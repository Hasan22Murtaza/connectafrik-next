import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { getPostAuthRedirect } from '@/lib/auth/postAuthRedirect'
import { authLinkErrorQuery } from '@/lib/auth/parseAuthHash'
import { clearAuthCookiesOnResponse } from '@/lib/auth/supabaseAuthCookies'

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

  if (!code) {
    if (authError || authErrorCode) {
      const errorQuery = authLinkErrorQuery(authErrorCode)
      return NextResponse.redirect(`${origin}/signin?error=${errorQuery}`)
    }
    if (flow === 'signup') {
      return NextResponse.redirect(`${origin}/signin?error=link_expired`)
    }
    return NextResponse.redirect(`${origin}/signin?error=auth`)
  }

  const cookieStore = await cookies()
  let response = NextResponse.next()

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
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { error, data } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    if (flow === 'signup') {
      return NextResponse.redirect(`${origin}/signin?error=link_expired`)
    }
    return NextResponse.redirect(`${origin}/signin?error=auth`)
  }

  if (flow === 'signup') {
    await supabase.auth.signOut()
    const redirectResponse = NextResponse.redirect(`${origin}/account-activated`)
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
  const redirectResponse = NextResponse.redirect(`${origin}${next}`)
  response.cookies.getAll().forEach(({ name, value }) => {
    redirectResponse.cookies.set(name, value)
  })
  return redirectResponse
}
