/**
 * Minimal local typing so this file type-checks before `@capacitor/cli` is
 * installed. Once you run `npm i -D @capacitor/cli`, you may replace this with:
 *   import type { CapacitorConfig } from '@capacitor/cli'
 */
type CapacitorConfig = {
  appId: string
  appName: string
  webDir: string
  server?: {
    url?: string
    cleartext?: boolean
    androidScheme?: string
    iosScheme?: string
    allowNavigation?: string[]
  }
  ios?: { scheme?: string }
  android?: Record<string, unknown>
}

/**
 * Capacitor configuration for the ConnectAfrik mobile apps (iOS + Android).
 *
 * The native shell loads the live Next.js app. Universal Links (iOS) and App
 * Links (Android) are configured natively (Associated Domains entitlement /
 * intent filters) and surfaced to the web layer via the `App.appUrlOpen`
 * listener handled in `app/components/DeepLinkHandler.tsx`.
 *
 * Per-platform identifiers (must stay in sync with the association files):
 *   - iOS bundle id   = NEXT_PUBLIC_IOS_BUNDLE_ID  (-> AASA appID)
 *   - Android package = NEXT_PUBLIC_ANDROID_PACKAGE (-> assetlinks package_name)
 *
 * Capacitor only stores ONE `appId` (used when scaffolding). We default it to
 * the iOS bundle. Because Android differs, set the Android `applicationId` in
 * android/app/build.gradle to NEXT_PUBLIC_ANDROID_PACKAGE — see
 * docs/deep-linking/android/build.gradle.snippet.gradle.
 */
const config: CapacitorConfig = {
  appId: process.env.NEXT_PUBLIC_IOS_BUNDLE_ID || 'com.senyoapp.connectAfrick',
  appName: 'ConnectAfrik',
  // Used only for bundled assets (icons/splash). The app itself is served from
  // `server.url` below so SSR + middleware keep working.
  webDir: 'public',
  server: {
    // Point the WebView at the deployed site for this environment. Override per
    // build (dev/staging/prod) with CAP_SERVER_URL.
    url: process.env.CAP_SERVER_URL || 'https://connectafrik.com',
    cleartext: false,
    // https origin keeps Secure cookies + Universal Links working.
    androidScheme: 'https',
    iosScheme: 'https',
    // Allow our own host to be navigated within the WebView.
    allowNavigation: ['connectafrik.com', '*.connectafrik.com'],
  },
  ios: {
    scheme: 'ConnectAfrik',
  },
}

export default config
