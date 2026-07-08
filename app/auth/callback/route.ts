import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { deepLinkConfig } from '@/lib/deeplink/config'

export const runtime = 'nodejs'

function getOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'

  if (forwardedHost) {
    const host = forwardedHost.split(',')[0]?.trim()
    if (host) return `${forwardedProto}://${host}`
  }

  return deepLinkConfig.webBaseUrl
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  let next = url.searchParams.get('redirect') ?? '/feed'
  const origin = getOrigin(request)

  if (!next.startsWith('/') || next.startsWith('//')) {
    next = '/feed'
  }

  const signinError = () =>
    NextResponse.redirect(`${origin}/signin?error=auth`)

  if (!code) {
    return signinError()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return signinError()
  }

  let sessionCookies: {
    name: string
    value: string
    options?: Parameters<NextResponse['cookies']['set']>[2]
  }[] = []

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
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return signinError()
    }

    const response = NextResponse.redirect(`${origin}${next}`)
    for (const { name, value, options } of sessionCookies) {
      response.cookies.set(name, value, options)
    }

    return response
  } catch {
    return signinError()
  }
}
