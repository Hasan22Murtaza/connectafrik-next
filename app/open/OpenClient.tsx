'use client'

import { useEffect, useRef, useState } from 'react'

type Platform = 'ios' | 'android' | 'desktop'

interface OpenClientProps {
  target: string
  universalLink: string
  schemeLink: string
  iosStoreUrl: string
  androidStoreUrl: string
}

const DEFERRED_LINK_KEY = 'connectafrik:deferred_deeplink'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  // iPadOS 13+ reports as Mac; detect touch to disambiguate.
  if (/Macintosh/.test(ua) && 'ontouchend' in document) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

/** Best-effort detection of being inside the Capacitor WebView (native app). */
function isInsideNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
  return Boolean(w.Capacitor?.isNativePlatform?.())
}

export default function OpenClient({
  target,
  universalLink,
  schemeLink,
  iosStoreUrl,
  androidStoreUrl,
}: OpenClientProps) {
  const [platform, setPlatform] = useState<Platform>('desktop')
  const [stalled, setStalled] = useState(false)
  const attempted = useRef(false)

  useEffect(() => {
    const p = detectPlatform()
    setPlatform(p)

    // Persist the destination so we can resume after install (deferred link).
    try {
      localStorage.setItem(
        DEFERRED_LINK_KEY,
        JSON.stringify({ target, ts: Date.now() })
      )
    } catch {
      /* storage may be unavailable */
    }

    // If we're already inside the native app, just route in-app.
    if (isInsideNativeApp()) {
      window.location.replace(target)
      return
    }

    // Desktop: nothing to "open" — continue on the web.
    if (p === 'desktop') {
      window.location.replace(universalLink)
      return
    }

    if (attempted.current) return
    attempted.current = true

    // Try to open the app via its custom scheme. If the app is installed it
    // foregrounds and this page is backgrounded; if not, we stay here and the
    // timeout fires to offer the store.
    const storeUrl = p === 'ios' ? iosStoreUrl : androidStoreUrl
    const start = Date.now()

    const timer = window.setTimeout(() => {
      // If the tab was backgrounded (app opened), don't bounce to the store.
      if (document.hidden || Date.now() - start > 2500) {
        setStalled(true)
        return
      }
      window.location.replace(storeUrl)
    }, 1500)

    const onVisibility = () => {
      if (document.hidden) window.clearTimeout(timer)
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Kick off the app-open attempt.
    window.location.href = schemeLink

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [target, universalLink, schemeLink, iosStoreUrl, androidStoreUrl])

  const storeUrl = platform === 'ios' ? iosStoreUrl : androidStoreUrl

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F97316]/10 via-[#149941]/10 to-[#0B7FB0]/10 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <img
          src="/assets/images/logo_2.png"
          alt="ConnectAfrik"
          className="mx-auto mb-6 w-28"
        />
        <h1 className="mb-2 text-xl font-bold text-gray-900">Opening ConnectAfrik…</h1>
        <p className="mb-6 text-sm text-gray-600">
          {stalled
            ? "Didn't open automatically? Use one of the options below."
            : 'Taking you to the app. This only takes a moment.'}
        </p>

        <div className="flex flex-col gap-3">
          <a
            href={schemeLink}
            className="rounded-lg bg-[var(--african-orange,#F97316)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Open in app
          </a>

          {platform !== 'desktop' && (
            <a
              href={storeUrl}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-800"
            >
              {platform === 'ios' ? 'Get it on the App Store' : 'Get it on Google Play'}
            </a>
          )}

          <a
            href={universalLink}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Continue on the web
          </a>
        </div>
      </div>
    </div>
  )
}

/**
 * Read (and consume) a previously stored deferred deep link. Call this once on
 * the first authenticated screen after a fresh install/login to resume the
 * destination the user originally intended.
 */
export function consumeDeferredDeepLink(): string | null {
  try {
    const raw = localStorage.getItem(DEFERRED_LINK_KEY)
    if (!raw) return null
    localStorage.removeItem(DEFERRED_LINK_KEY)
    const parsed = JSON.parse(raw) as { target?: string; ts?: number }
    // Expire deferred links after 1 hour to avoid stale redirects.
    if (!parsed.target || !parsed.ts || Date.now() - parsed.ts > 3600_000) return null
    return parsed.target
  } catch {
    return null
  }
}
