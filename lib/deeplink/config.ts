/**
 * Environment-aware deep linking configuration.
 *
 * Drives Universal Links (iOS), App Links (Android), custom-scheme fallbacks,
 * the .well-known association files, and the smart link resolver.
 *
 * All values are overridable via environment variables so the same code path
 * works in development, staging, and production.
 */

export type DeepLinkEnvironment = 'development' | 'staging' | 'production'

function pickEnvironment(): DeepLinkEnvironment {
  const explicit = process.env.NEXT_PUBLIC_DEEPLINK_ENV as DeepLinkEnvironment | undefined
  if (explicit === 'development' || explicit === 'staging' || explicit === 'production') {
    return explicit
  }
  if (process.env.VERCEL_ENV === 'production') return 'production'
  if (process.env.VERCEL_ENV === 'preview') return 'staging'
  if (process.env.NODE_ENV === 'production') return 'production'
  return 'development'
}

/** Remove a trailing slash so we can safely concatenate paths. */
function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

const ENVIRONMENT = pickEnvironment()

/**
 * Public web base URL. This is also the host that serves the association
 * files, so it MUST match the domain registered in the iOS Associated Domains
 * entitlement and the Android intent filters.
 */
const WEB_BASE_URL = stripTrailingSlash(
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
)

export const deepLinkConfig = {
  environment: ENVIRONMENT,

  /** e.g. https://connectafrik.com (prod) or http://localhost:3000 (dev). */
  webBaseUrl: WEB_BASE_URL,

  /** Host only, used inside the AASA / assetlinks payloads. */
  host: (() => {
    try {
      return new URL(WEB_BASE_URL).host
    } catch {
      return 'connectafrik.com'
    }
  })(),

  /** Custom URL scheme fallback (e.g. connectafrik://post/123). */
  scheme: process.env.NEXT_PUBLIC_DEEPLINK_SCHEME || 'connectafrik',

  ios: {
    /** Bundle identifier of the iOS app. */
    bundleId: process.env.NEXT_PUBLIC_IOS_BUNDLE_ID || 'com.senyoapp.connectAfrick',
    /** Apple Developer Team ID (prefix for the AASA appID). */
    teamId: process.env.APPLE_TEAM_ID || '5P2C27ZV83',
    /** Numeric App Store id, used to build the App Store fallback URL. */
    appStoreId: process.env.NEXT_PUBLIC_IOS_APP_STORE_ID || '',
  },

  android: {
    /** Application id of the Android app. */
    packageName: process.env.NEXT_PUBLIC_ANDROID_PACKAGE || 'com.example.connectafrik',
    /**
     * SHA-256 signing-certificate fingerprints (comma separated).
     * Include BOTH the upload key and the Play App Signing key.
     */
    sha256CertFingerprints: (
      process.env.ANDROID_SHA256_CERT_FINGERPRINTS ||
      '57:4A:E0:49:8D:A1:73:28:C6:75:32:F9:5A:48:3D:26:A2:34:D8:9F:D0:8B:23:AC:73:EA:8A:AB:94:C9:8C:68,3D:1F:61:FA:84:53:97:9C:03:1C:54:2C:AB:5E:09:62:D5:A6:9D:6D:E1:5A:11:92:6D:61:5D:8E:91:3B:D8:B3'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
} as const

/** App Store (iOS) fallback URL when the app is not installed. */
export function appStoreUrl(): string {
  const id = deepLinkConfig.ios.appStoreId
  return id
    ? `https://apps.apple.com/app/id${id}`
    : 'https://apps.apple.com/'
}

/** Play Store (Android) fallback URL, optionally carrying a deferred-link referrer. */
export function playStoreUrl(referrer?: string): string {
  const base = `https://play.google.com/store/apps/details?id=${deepLinkConfig.android.packageName}`
  if (!referrer) return base
  return `${base}&referrer=${encodeURIComponent(referrer)}`
}

/** Full AASA appID value: <TeamID>.<BundleID>. */
export function appleAppId(): string {
  return `${deepLinkConfig.ios.teamId}.${deepLinkConfig.ios.bundleId}`
}
