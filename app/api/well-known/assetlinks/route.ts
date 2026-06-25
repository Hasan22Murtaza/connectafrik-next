import { NextResponse } from 'next/server'
import { deepLinkConfig } from '@/lib/deeplink/config'

/**
 * Digital Asset Links for Android App Links.
 *
 * Exposed publicly at `/.well-known/assetlinks.json` via a rewrite in
 * next.config. Served as JSON over HTTPS with no redirects.
 *
 * `ANDROID_SHA256_CERT_FINGERPRINTS` MUST include both the upload key and the
 * Google Play App Signing key, or autoVerify will fail for Play builds.
 */
export const dynamic = 'force-static'
export const revalidate = 3600

export async function GET() {
  const body = [
    {
      relation: [
        'delegate_permission/common.handle_all_urls',
        'delegate_permission/common.get_login_creds',
      ],
      target: {
        namespace: 'android_app',
        package_name: deepLinkConfig.android.packageName,
        sha256_cert_fingerprints: deepLinkConfig.android.sha256CertFingerprints,
      },
    },
  ]

  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
