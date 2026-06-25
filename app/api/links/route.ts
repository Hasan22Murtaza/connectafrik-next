import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  normalizeTarget,
  buildUniversalLink,
  buildSchemeLink,
  buildResolverLink,
} from '@/lib/deeplink/links'
import { signLinkToken } from '@/lib/deeplink/links.server'
import { deepLinkConfig } from '@/lib/deeplink/config'

/**
 * Backend dynamic deep link generator.
 *
 * POST /api/links
 * Body: { target: string, signed?: boolean, ttlSeconds?: number }
 *
 * Returns the canonical Universal Link (opens app if installed, else web),
 * a custom-scheme fallback, and a smart-resolver URL. When `signed` is true a
 * tamper-proof, time-limited token is attached to the resolver URL — use this
 * for sensitive flows (invites, one-time actions).
 *
 * Security:
 *  - Requires an authenticated user.
 *  - `target` is validated against the deep-link allowlist (no open redirects).
 *  - Signed tokens are HMAC-signed + expiring.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)

    const body = await request.json().catch(() => ({}))
    const rawTarget = typeof body?.target === 'string' ? body.target : ''
    const signed = body?.signed === true
    const ttlSeconds =
      typeof body?.ttlSeconds === 'number' && body.ttlSeconds > 0
        ? Math.min(body.ttlSeconds, 60 * 60 * 24 * 7) // cap at 7 days
        : undefined

    const target = normalizeTarget(rawTarget)
    if (!target) {
      return errorResponse('Invalid or unsupported deep link target', 400)
    }

    let token: string | undefined
    if (signed) {
      if (!deepLinkConfig.signingSecret) {
        return errorResponse('Link signing is not configured on the server', 500)
      }
      token = signLinkToken({ target, src: user.id, ttlSeconds })
    }

    return jsonResponse({
      target,
      universalLink: buildUniversalLink(target),
      schemeLink: buildSchemeLink(target),
      resolverLink: buildResolverLink(target, token ? { token } : undefined),
      environment: deepLinkConfig.environment,
      expiresIn: ttlSeconds ?? null,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Failed to generate link', 500)
  }
}
