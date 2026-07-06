import type { NextRequest } from 'next/server'

/**
 * Canonical public origin for auth redirects (OAuth callback, email links, etc.).
 *
 * Behind a reverse proxy (Cloudflare, nginx) `request.url` often reflects the
 * internal upstream (e.g. localhost:3000). Prefer the configured app URL or
 * forwarded host so redirects stay on connectafrik.com in production.
 */
export function getAppOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (configured) {
    return configured
  }

  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost) {
    const host = forwardedHost.split(',')[0]?.trim()
    if (host) {
      const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
      return `${proto}://${host}`
    }
  }

  const host = request.headers.get('host')
  if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    return `${proto}://${host}`
  }

  return new URL(request.url).origin
}
