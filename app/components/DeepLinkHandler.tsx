'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { deepLinkConfig } from '@/lib/deeplink/config'
import { normalizeTarget } from '@/lib/deeplink/links'

/**
 * Bridges native Universal Links / App Links / custom-scheme URLs into the
 * Next.js router when running inside the Capacitor native shell.
 *
 * On the web this is a no-op (Universal/App Links are handled by the browser
 * and the normal route table).
 */

/** Turn any inbound deep link URL into an internal path (`/post/123?x=1`). */
function extractInternalPath(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)

    // Custom scheme: connectafrik://post/123 -> host="post", path="/123".
    if (url.protocol === `${deepLinkConfig.scheme}:`) {
      const path = `/${url.host}${url.pathname}`.replace(/\/{2,}/g, '/')
      const cleaned = path.replace(/\/$/, '') || '/'
      return `${cleaned}${url.search}`
    }

    // Universal/App Link: only accept our own host.
    if (url.host === deepLinkConfig.host) {
      return `${url.pathname}${url.search}` || '/'
    }

    return null
  } catch {
    return null
  }
}

/** Routes that must be handled by the server (set cookies, exchange codes). */
function isServerHandledRoute(path: string): boolean {
  return path.startsWith('/.well-known') || path.startsWith('/api/')
}

export default function DeepLinkHandler() {
  const router = useRouter()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let remove: (() => void) | undefined

    const navigate = (rawUrl: string) => {
      const path = extractInternalPath(rawUrl)
      if (!path) return

      const [pathnameOnly] = path.split('?')

      // The /open resolver should resolve in-app to its target directly.
      if (pathnameOnly === '/open') {
        try {
          const target = new URL(rawUrl).searchParams.get('target')
          const safe = normalizeTarget(target)
          if (safe) {
            router.push(safe)
            return
          }
        } catch {
          /* fall through */
        }
      }

      if (isServerHandledRoute(pathnameOnly)) {
        // Full navigation so middleware / route handlers run.
        window.location.assign(path)
        return
      }

      router.push(path)
    }

    ;(async () => {
      const { App } = await import('@capacitor/app')

      // Cold start: the app may have been launched from a link.
      try {
        const launch = await App.getLaunchUrl()
        if (launch?.url) navigate(launch.url)
      } catch {
        /* no launch url */
      }

      // Warm start: link opened while the app is already running.
      const handle = await App.addListener('appUrlOpen', (event) => {
        if (event?.url) navigate(event.url)
      })
      remove = () => {
        handle.remove()
      }
    })()

    return () => {
      remove?.()
    }
  }, [router])

  return null
}
