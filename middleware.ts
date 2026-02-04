import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Supabase auth cookie key derived from project URL (matches default in supabase-js). */
function getSupabaseAuthCookieKey(): string {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url) return 'sb-auth-token'
    const hostname = new URL(url).hostname.split('.')[0]
    return `sb-${hostname}-auth-token`
  } catch {
    return 'sb-auth-token'
  }
}

/** Clear Supabase auth cookies (base key + chunked keys) so user is treated as signed out. */
function clearSupabaseAuthCookies(
  request: NextRequest,
  response: NextResponse,
  baseKey: string
): NextResponse {
  const options = { path: '/' }
  for (const name of [baseKey, ...Array.from({ length: 12 }, (_, i) => `${baseKey}.${i}`)]) {
    request.cookies.set({ name, value: '', ...options })
    response.cookies.set(name, '', options)
  }
  return NextResponse.next({
    request: { headers: request.headers },
  })
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const authCookieKey = getSupabaseAuthCookieKey()

  // Create a Supabase client configured to use cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Get the current session (may throw if refresh token is invalid)
  let session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] = null
  let didClearAuthCookies = false
  try {
    const { data } = await supabase.auth.getSession()
    session = data.session
  } catch (err: unknown) {
    // Invalid or missing refresh token (e.g. refresh_token_not_found) or malformed session
    const isAuthError =
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'refresh_token_not_found'
    if (isAuthError || (err && typeof err === 'object' && '__isAuthError' in err)) {
      response = clearSupabaseAuthCookies(request, response, authCookieKey)
      didClearAuthCookies = true
    }
    // Proceed with session = null so user is treated as unauthenticated
  }

  const { pathname } = request.nextUrl

  /** Ensure auth cookies are cleared on an outgoing response (e.g. redirect). */
  const applyClearedAuthCookiesIfNeeded = (res: NextResponse) => {
    if (!didClearAuthCookies) return res
    const options = { path: '/' }
    for (const name of [authCookieKey, ...Array.from({ length: 12 }, (_, i) => `${authCookieKey}.${i}`)]) {
      res.cookies.set(name, '', options)
    }
    return res
  }

  // Define route categories
  const authRoutes = ['/signin', '/signup', '/forgot-password', '/reset-password']
  const protectedRoutes = [
    '/feed',
    '/friends',
    '/groups',
    '/marketplace',
    '/profile',
    '/saved',
    '/memories',
    '/video',
    '/my-orders',
  ]
  const publicRoutes = [
    '/',
    '/culture',
    '/politics',
    '/guidelines',
    '/our-story',
    '/privacy-policy',
    '/terms-of-service',
    '/support',
  ]

  // Check if the current path is an auth route
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))
  
  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith('/user/') ||
    pathname.startsWith('/marketplace/')

  // Check if the current path is a public route
  const isPublicRoute = publicRoutes.some((route) => pathname === route)

  // If user is authenticated and tries to access auth routes, redirect to feed
  if (session && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/feed'
    return applyClearedAuthCookiesIfNeeded(NextResponse.redirect(url))
  }

  // If user is not authenticated and tries to access protected routes, redirect to signin
  if (!session && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/signin'
    url.searchParams.set('redirect', pathname)
    return applyClearedAuthCookiesIfNeeded(NextResponse.redirect(url))
  }

  // Allow access to public routes, protected routes (if authenticated), and API routes
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

