'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { authLinkErrorQuery, parseAuthHash } from '@/lib/auth/parseAuthHash'

/**
 * Legacy fallback: Supabase may still land auth hash fragments on pages other than
 * /confirm-signup (old email links). Strip errors and route to sign-in; never send
 * users to account-activated from here.
 */
export default function SignupEmailConfirmHandler() {
  const router = useRouter()
  const pathname = usePathname()
  const handled = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || handled.current) return
    if (pathname === '/confirm-signup' || pathname === '/account-activated') return

    const hashResult = parseAuthHash(window.location.hash)
    if (hashResult.kind === 'none') return

    handled.current = true

    if (hashResult.kind === 'error') {
      const errorQuery = authLinkErrorQuery(hashResult.errorCode)
      router.replace(`/signin?error=${errorQuery}`)
      return
    }

    if (hashResult.kind === 'signup') {
      const query = window.location.search
      router.replace(`/confirm-signup${query}${window.location.hash}`)
    }
  }, [pathname, router])

  return null
}
