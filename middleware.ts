import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

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

  // Get the current session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

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
    return NextResponse.redirect(url)
  }

  // If user is not authenticated and tries to access protected routes, redirect to signin
  if (!session && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/signin'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
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

