'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useOnboarding } from './OnboardingProvider'
import { destroyActiveTour } from './runTour'

/**
 * Watches the route and starts a first-time tour when progress says not done.
 * Mount once inside each module shell.
 */
export function ScreenOnboarding() {
  const pathname = usePathname() || ''
  const { ready, startTourForPath } = useOnboarding()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    if (!ready) return
    if (lastPath.current === pathname) return

    // Stop any in-flight tour when navigating between screens
    if (lastPath.current !== null) {
      destroyActiveTour()
    }
    lastPath.current = pathname

    const timer = window.setTimeout(() => {
      startTourForPath(pathname, false)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [ready, pathname, startTourForPath])

  return null
}
