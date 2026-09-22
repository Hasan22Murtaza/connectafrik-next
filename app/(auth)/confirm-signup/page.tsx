'use client'

import React, { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from '@/shared/icons'
import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api-client'
import { authLinkErrorQuery, parseAuthHash } from '@/lib/auth/parseAuthHash'
import { AuthPageShell } from '@/shared/components/auth/AuthPageShell'

const ConfirmSignupForm: React.FC = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    void (async () => {
      const hashResult = parseAuthHash(window.location.hash)
      if (hashResult.kind === 'error') {
        const errorQuery = authLinkErrorQuery(hashResult.errorCode)
        router.replace(`/signin?error=${errorQuery}`)
        return
      }

      const code = searchParams.get('code')
      if (code) {
        try {
          await apiClient.post<{ ok: boolean }>('/api/auth/confirm-signup', { code })
          window.location.replace('/account-activated')
        } catch {
          router.replace('/signin?error=link_expired')
        }
        return
      }

      if (hashResult.kind === 'signup') {
        try {
          if (hashResult.refreshToken) {
            await supabase.auth.setSession({
              access_token: hashResult.accessToken,
              refresh_token: hashResult.refreshToken,
            })
          }
          await supabase.auth.signOut({ scope: 'local' })
          window.location.replace('/account-activated')
        } catch {
          router.replace('/signin?error=auth')
        }
        return
      }

      router.replace('/signin?error=auth')
    })()
  }, [router, searchParams])

  return (
    <div className="py-4 text-center">
      <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary-600" />
      <p className="font-medium text-content">Confirming your account…</p>
      <p className="mt-2 text-sm text-content-secondary">Please wait a moment.</p>
    </div>
  )
}

const ConfirmSignup: React.FC = () => {
  return (
    <AuthPageShell title="Confirming account" subtitle="Please wait a moment.">
      <Suspense
        fallback={
          <div className="py-4 text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary-600" />
            <p className="font-medium text-content">Loading…</p>
          </div>
        }
      >
        <ConfirmSignupForm />
      </Suspense>
    </AuthPageShell>
  )
}

export default ConfirmSignup
