import type { NextResponse } from 'next/server'

/** Supabase auth cookie key derived from project URL (matches default in supabase-js). */
export function getSupabaseAuthCookieKey(): string {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url) return 'sb-auth-token'
    const hostname = new URL(url).hostname.split('.')[0]
    return `sb-${hostname}-auth-token`
  } catch {
    return 'sb-auth-token'
  }
}

export function getSupabaseAuthCookieNames(baseKey = getSupabaseAuthCookieKey()): string[] {
  return [baseKey, ...Array.from({ length: 12 }, (_, i) => `${baseKey}.${i}`)]
}

/** Clear Supabase auth cookies on an outgoing response (e.g. redirect after sign-out). */
export function clearAuthCookiesOnResponse(response: NextResponse): NextResponse {
  const options = { path: '/', maxAge: 0 }
  for (const name of getSupabaseAuthCookieNames()) {
    response.cookies.set(name, '', options)
  }
  return response
}
