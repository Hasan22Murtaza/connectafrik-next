import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  getSupabaseAuthCookieKey,
  getSupabaseAuthCookieNames,
} from '@/lib/auth/supabaseAuthCookies'

/** Clear Supabase auth cookies (base key + chunked keys) so user is treated as signed out. */
function clearSupabaseAuthCookies(
  request: NextRequest,
  response: NextResponse,
  baseKey: string
): NextResponse {
  const options = { path: '/' }
  for (const name of getSupabaseAuthCookieNames(baseKey)) {
    request.cookies.set({ name, value: '', ...options })
    response.cookies.set(name, '', options)
  }
  return NextResponse.next({
    request: { headers: request.headers },
  })
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // OAuth callback exchanges the PKCE code — skip session refresh so verifier cookies stay intact.
  if (pathname === '/auth/callback' || pathname === '/api/auth/callback') {
    return NextResponse.next()
  }

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
  const authRoutesThatRedirectWhenLoggedIn = [
    '/signin',
    '/signup',
    '/forgot-password',
    '/reset-password',
  ]
  const protectedRoutes = [
    '/feed',
    '/friends',
    '/groups',
    '/profile',
    '/saved',
    '/memories',
    '/video',
    '/my-orders',
    '/culture',
    '/politics',
  ]
  const publicRoutes = [
    '/',
    '/guidelines',
    '/our-story',
    '/privacy-policy',
    '/terms-of-service',
    '/support',
    '/marketplace',
  ]

  const isMarketplaceHubRoute =
    pathname.startsWith('/marketplace/selling') ||
    pathname.startsWith('/marketplace/buying')
  const isMarketplaceProductDetail =
    /^\/marketplace\/[^/]+$/.test(pathname) && !isMarketplaceHubRoute

  const isAuthRouteThatRedirectsWhenLoggedIn = authRoutesThatRedirectWhenLoggedIn.some((route) =>
    pathname.startsWith(route)
  )
  
  // Check if the current path is a protected route
  const isProtectedRoute =
    protectedRoutes.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith('/user/') ||
    isMarketplaceHubRoute

  // Check if the current path is a public route
  const isPublicRoute =
    publicRoutes.some((route) => pathname === route) || isMarketplaceProductDetail

  // If user is authenticated and tries to access sign-in/sign-up routes, redirect to feed
  if (session && isAuthRouteThatRedirectsWhenLoggedIn) {
    const url = request.nextUrl.clone()
    url.pathname = '/feed'
    return applyClearedAuthCookiesIfNeeded(NextResponse.redirect(url))
  }

  // If user is authenticated and lands on home page, send them to feed
  if (session && pathname === '/') {
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
     * - .well-known (deep link association files: AASA / assetlinks.json)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

