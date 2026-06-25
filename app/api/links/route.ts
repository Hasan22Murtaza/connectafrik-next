import { NextRequest } from 'next/server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  normalizeTarget,
  buildUniversalLink,
  buildSchemeLink,
  buildResolverLink,
} from '@/lib/deeplink/links'
import { deepLinkConfig } from '@/lib/deeplink/config'

/**
 * Backend dynamic deep link generator.
 *
 * POST /api/links
 * Body: { target: string }
 *
 * Returns the canonical Universal Link (opens app if installed, else web),
 * a custom-scheme fallback, and a smart-resolver URL.
 *
 * Security:
 *  - Requires an authenticated user.
 *  - `target` is validated against the deep-link allowlist (no open redirects).
 */
export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser(request)

    const body = await request.json().catch(() => ({}))
    const rawTarget = typeof body?.target === 'string' ? body.target : ''

    const target = normalizeTarget(rawTarget)
    if (!target) {
      return errorResponse('Invalid or unsupported deep link target', 400)
    }

    return jsonResponse({
      target,
      universalLink: buildUniversalLink(target),
      schemeLink: buildSchemeLink(target),
      resolverLink: buildResolverLink(target),
      environment: deepLinkConfig.environment,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || error?.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error?.message || 'Failed to generate link', 500)
  }
}
