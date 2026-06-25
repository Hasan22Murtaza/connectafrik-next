import { Suspense } from 'react'
import { normalizeTarget, buildSchemeLink, buildUniversalLink } from '@/lib/deeplink/links'
import { verifyLinkToken } from '@/lib/deeplink/links.server'
import { appStoreUrl, playStoreUrl } from '@/lib/deeplink/config'
import OpenClient from './OpenClient'

/**
 * Smart deep link resolver / fallback page.
 *
 * Reached when:
 *  - A user taps an "Open in app" link.
 *  - A Universal/App Link is opened in a context that can't hand off to the app
 *    (e.g. some in-app browsers), so we degrade gracefully.
 *  - The app isn't installed -> we send the user to the right store and
 *    remember the destination for after install (deferred deep linking).
 *
 * Security: the target is validated against an allowlist. If a signed token is
 * supplied it must verify; an invalid/expired token falls back to /feed.
 */
export default async function OpenPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string; t?: string }>
}) {
  const params = await searchParams

  // A signed token (if present) takes precedence over a raw target param.
  const fromToken = verifyLinkToken(params.t)?.target ?? null
  const target = normalizeTarget(fromToken ?? params.target ?? null) ?? '/feed'

  return (
    <Suspense fallback={null}>
      <OpenClient
        target={target}
        universalLink={buildUniversalLink(target)}
        schemeLink={buildSchemeLink(target)}
        iosStoreUrl={appStoreUrl()}
        androidStoreUrl={playStoreUrl(`target=${encodeURIComponent(target)}`)}
      />
    </Suspense>
  )
}
