import { NextResponse } from 'next/server'
import { appleAppId } from '@/lib/deeplink/config'

/**
 * Apple App Site Association (AASA) for iOS Universal Links.
 *
 * Exposed publicly at `/.well-known/apple-app-site-association` via a rewrite in
 * next.config (see `rewrites()`). Must be served as application/json over HTTPS
 * with NO redirects and NO file extension on the public path.
 *
 * `components` (iOS 13+) decide which URL paths open the app; asset/API paths
 * are excluded so the website keeps serving them.
 */
export const dynamic = 'force-static'
export const revalidate = 3600

export async function GET() {
  const appID = appleAppId()

  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appID,
          appIDs: [appID],
          components: [
            { '/': '/api/auth/callback', comment: 'OAuth / social login redirect' },
            { '/': '/api/*', exclude: true, comment: 'Let API calls hit the server' },
            { '/': '/_next/*', exclude: true, comment: 'Framework assets' },
            { '/': '/.well-known/*', exclude: true },
            { '/': '/post/*', comment: 'Shared posts' },
            { '/': '/user/*', comment: 'User profiles' },
            { '/': '/groups/*', comment: 'Groups' },
            { '/': '/marketplace/*', comment: 'Marketplace listings' },
            { '/': '/memories/*', comment: 'Memories' },
            { '/': '/chat/*', comment: 'Chat threads' },
            { '/': '/feed', comment: 'Feed' },
            { '/': '/open', comment: 'Smart resolver' },
            { '/': '/confirm-signup', comment: 'Account activation' },
            { '/': '/account-activated' },
            { '/': '/reset-password', comment: 'Password reset' },
            { '/': '/verify-otp', comment: 'Email / OTP verification' },
          ],
          paths: [
            '/api/auth/callback',
            'NOT /api/*',
            'NOT /_next/*',
            'NOT /.well-known/*',
            '/post/*',
            '/user/*',
            '/groups/*',
            '/marketplace/*',
            '/memories/*',
            '/chat/*',
            '/feed',
            '/open',
            '/confirm-signup',
            '/account-activated',
            '/reset-password',
          ],
        },
      ],
    },
    webcredentials: {
      apps: [appID],
    },
  }

  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
