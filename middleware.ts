import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  getSupabaseAuthCookieKey,
  getSupabaseAuthCookieNames,
} from '@/lib/auth/supabaseAuthCookies'

/** Exact path or nested under route — avoids `/feed` matching `/feedback`. */
function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`)
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

/**
 * Prefer `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL`, then forwarded Host,
 * so auth redirects never leak an internal bind address (localhost:3000).
 */
function resolvePublicOrigin(request: NextRequest): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim()

  if (configured) {
    try {
      const origin = new URL(configured).origin
      if (!isLoopbackHost(new URL(configured).hostname)) return origin
    } catch {
      // fall through to request headers
    }
  }

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const hostHeader = forwardedHost || request.headers.get('host')?.trim()
  if (hostHeader) {
    const hostname = hostHeader.split(':')[0]
    if (!isLoopbackHost(hostname)) {
      const forwardedProto = request.headers
        .get('x-forwarded-proto')
        ?.split(',')[0]
        ?.trim()
      const proto = forwardedProto || 'https'
      return `${proto}://${hostHeader}`
    }
  }

  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      // fall through
    }
  }

  return request.nextUrl.origin
}

/** Absolute redirect URL on the public origin (never trust internal nextUrl host alone). */
function publicUrl(
  request: NextRequest,
  pathname: string,
  searchParams?: Record<string, string>
): URL {
  const url = new URL(pathname, `${resolvePublicOrigin(request)}/`)
  url.search = ''
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value)
    }
  }
  return url
}

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

  if (pathname === '/memories' || pathname.startsWith('/memories/')) {
    const nextPath = pathname.replace(/^\/memories/, '/reels') || '/reels'
    return NextResponse.redirect(publicUrl(request, nextPath), 308)
  }
  if (pathname === '/api/memories' || pathname.startsWith('/api/memories/')) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.replace(/^\/api\/memories/, '/api/reels')
    return NextResponse.rewrite(url)
  }

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
    '/settings',
    '/saved',
    '/reels',
    '/my-orders',
    '/culture',
    '/politics',
  ]
  const publicRoutes = [
    '/',
    '/guidelines',
    '/our-story',
    '/privacy-policy',
    '/privacy',
    '/terms-of-service',
    '/terms',
    '/support',
    '/contact',
    '/help',
    '/feedback',
    '/marketplace',
    '/community-standards',
    '/child-safety',
    '/safety',
    '/cookie-policy',
    '/copyright',
    '/delete-account',
    '/delete-data',
    '/account-recovery',
    '/report',
    '/emergency-report',
    '/appeals',
    '/parents',
    '/youth-safety',
    '/security',
    '/sister-cities',
    '/mentor-verification',
    '/mentor-guidelines',
    '/become-a-mentor',
    '/mentors',
    '/marketplace-policy',
    '/marketplace-safety',
    '/tradehub-policy',
    '/privacy-center',
  ]
  const publicPrefixes = [
    '/privacy/',
    '/safety/',
    '/appeals/',
    '/parents/',
    '/sister-cities/',
    '/security/',
  ]

  const reelAppSegments = new Set(['foryou', 'explore', 'following', 'my-videos', 'create'])
  const isPublicSeoContentPath =
    /^\/post\/[^/]+\/?$/.test(pathname) ||
    (/^\/groups\/[^/]+\/?$/.test(pathname) && !pathname.startsWith('/groups/create')) ||
    /^\/groups\/[^/]+\/post\/[^/]+\/?$/.test(pathname) ||
    (() => {
      const match = pathname.match(/^\/reels\/([^/]+)\/?$/)
      return Boolean(match && !reelAppSegments.has(match[1]))
    })()

  const isMarketplaceHubRoute =
    pathname.startsWith('/marketplace/selling') ||
    pathname.startsWith('/marketplace/buying')
  const isMarketplaceProductDetail =
    /^\/marketplace\/[^/]+$/.test(pathname) && !isMarketplaceHubRoute

  const isAuthRouteThatRedirectsWhenLoggedIn = authRoutesThatRedirectWhenLoggedIn.some((route) =>
    matchesRoute(pathname, route)
  )

  // Check if the current path is a protected route
  const isProtectedRoute =
    !isPublicSeoContentPath &&
    (protectedRoutes.some((route) => matchesRoute(pathname, route)) ||
      pathname.startsWith('/user/') ||
      matchesRoute(pathname, '/admin') ||
      isMarketplaceHubRoute)

  // Check if the current path is a public route
  const isPublicRoute =
    publicRoutes.some((route) => pathname === route) ||
    publicPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    isMarketplaceProductDetail

  // If user is authenticated and tries to access sign-in/sign-up routes, redirect to feed
  if (session && isAuthRouteThatRedirectsWhenLoggedIn) {
    return applyClearedAuthCookiesIfNeeded(
      NextResponse.redirect(publicUrl(request, '/feed'))
    )
  }

  // If user is authenticated and lands on home page, send them to feed
  if (session && pathname === '/') {
    return applyClearedAuthCookiesIfNeeded(
      NextResponse.redirect(publicUrl(request, '/feed'))
    )
  }

  // If user is not authenticated and tries to access protected routes, redirect to signin
  if (!session && isProtectedRoute) {
    return applyClearedAuthCookiesIfNeeded(
      NextResponse.redirect(publicUrl(request, '/signin', { redirect: pathname }))
    )
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

