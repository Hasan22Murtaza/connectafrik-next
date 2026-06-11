'use client'

import React, { Suspense, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api-client'
import { authLinkErrorQuery, parseAuthHash } from '@/lib/auth/parseAuthHash'

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
    <div className="card py-10">
      <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-4" />
      <p className="text-content font-medium">Confirming your account…</p>
      <p className="text-content-secondary text-sm mt-2">Please wait a moment.</p>
    </div>
  )
}

const ConfirmSignup: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F97316]/15 via-[#149941]/15 to-[#0B7FB0]/15 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="flex items-center justify-center mb-6">
          <Link href="/">
            <img src="/assets/images/logo_2.png" alt="ConnectAfrik" className="w-30" />
          </Link>
        </div>
        <Suspense
          fallback={
            <div className="card py-10">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-4" />
              <p className="text-content font-medium">Loading…</p>
            </div>
          }
        >
          <ConfirmSignupForm />
        </Suspense>
      </div>
    </div>
  )
}

export default ConfirmSignup
