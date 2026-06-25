/**
 * Isomorphic deep link builders + validators.
 *
 * Safe to import from both client and server code (no Node-only imports).
 * Cryptographic signing lives in `links.server.ts`.
 */

import { deepLinkConfig } from './config'

/**
 * Allowlist of internal route prefixes that may be targeted by a deep link.
 * Anything not matching is rejected to prevent open-redirect / spoofed links.
 *
 * Each entry is a RegExp matched against the pathname (no query/hash).
 */
const ALLOWED_TARGET_PATTERNS: RegExp[] = [
  /^\/feed\/?$/,
  /^\/post\/[A-Za-z0-9_-]+\/?$/,
  /^\/user\/[A-Za-z0-9_.-]+\/?$/,
  /^\/groups(\/[A-Za-z0-9_-]+)?\/?$/,
  /^\/marketplace(\/[A-Za-z0-9_-]+)?\/?$/,
  /^\/memories(\/[A-Za-z0-9_-]+)?\/?$/,
  /^\/video\/?$/,
  /^\/chat(\/[A-Za-z0-9_-]+)?\/?$/,
  /^\/notifications\/?$/,
  /^\/saved\/?$/,
  // Auth flows
  /^\/confirm-signup\/?$/,
  /^\/account-activated\/?$/,
  /^\/reset-password\/?$/,
  /^\/verify-otp\/?$/,
  /^\/auth\/callback\/?$/,
]

/**
 * Validate that a target is a safe, internal, allowlisted path.
 * Returns a normalized pathname (with leading slash, query preserved) or null.
 */
export function normalizeTarget(rawTarget: string | null | undefined): string | null {
  if (!rawTarget) return null
  let target = rawTarget.trim()
  if (!target) return null

  // Allow absolute URLs only if they point at our own host; reduce to path.
  if (/^https?:\/\//i.test(target)) {
    try {
      const url = new URL(target)
      if (url.host !== deepLinkConfig.host) return null
      target = `${url.pathname}${url.search}`
    } catch {
      return null
    }
  }

  // Must be an internal absolute path, never protocol-relative.
  if (!target.startsWith('/') || target.startsWith('//')) return null

  const [pathname] = target.split('?')
  const isAllowed = ALLOWED_TARGET_PATTERNS.some((re) => re.test(pathname))
  return isAllowed ? target : null
}

/** True if a target path is allowlisted for deep linking. */
export function isAllowedTarget(rawTarget: string | null | undefined): boolean {
  return normalizeTarget(rawTarget) !== null
}

/**
 * Build the canonical Universal/App Link for a target screen.
 * This is the HTTPS URL you share publicly — it opens the app if installed,
 * otherwise the website (or the smart resolver / store fallback).
 *
 * @example buildUniversalLink('/post/123') -> https://connectafrik.com/post/123
 */
export function buildUniversalLink(target: string): string {
  const normalized = normalizeTarget(target) ?? '/feed'
  return `${deepLinkConfig.webBaseUrl}${normalized}`
}

/**
 * Build the custom-scheme URL used as a fallback when Universal/App Links
 * don't fire (e.g. some in-app browsers).
 *
 * @example buildSchemeLink('/post/123') -> connectafrik://post/123
 */
export function buildSchemeLink(target: string): string {
  const normalized = normalizeTarget(target) ?? '/feed'
  const withoutLeadingSlash = normalized.replace(/^\//, '')
  return `${deepLinkConfig.scheme}://${withoutLeadingSlash}`
}

/**
 * Build a smart resolver URL (`/open?target=…`). Use this for "Open in app"
 * buttons and store-fallback scenarios. The resolver page performs device
 * detection and deferred-deep-link persistence.
 */
export function buildResolverLink(
  target: string,
  opts?: { token?: string }
): string {
  const normalized = normalizeTarget(target) ?? '/feed'
  const params = new URLSearchParams({ target: normalized })
  if (opts?.token) params.set('t', opts.token)
  return `${deepLinkConfig.webBaseUrl}/open?${params.toString()}`
}

/**
 * Convenience: the public, shareable link for a piece of content.
 * Defaults to the canonical Universal Link (best UX: silently opens the app).
 */
export function buildShareLink(target: string): string {
  return buildUniversalLink(target)
}
