'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getPostAuthRedirect } from '@/lib/auth/postAuthRedirect'

function AuthCallbackContent() {
  const searchParams = useSearchParams()
  const [message] = useState('Signing you in...')

  useEffect(() => {
    let cancelled = false

    async function completeOAuth() {
      const code = searchParams.get('code')
      const redirectParam = searchParams.get('redirect')

      if (!code) {
        window.location.replace('/signin?error=auth')
        return
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (cancelled) return

      if (error) {
        console.error('OAuth callback failed:', error.message)
        window.location.replace('/signin?error=auth')
        return
      }

      const accessToken = data.session?.access_token
      if (accessToken) {
        try {
          await fetch('/api/auth/login-alert', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            keepalive: true,
          })
        } catch {
          /* login alert is best-effort */
        }
      }

      const platformRole =
        (data.session?.user?.app_metadata?.platform_role as string | undefined) ??
        (data.session?.user?.user_metadata?.platform_role as string | undefined)

      const redirectTo = getPostAuthRedirect(platformRole, redirectParam)
      window.location.replace(redirectTo)
    }

    void completeOAuth()

    return () => {
      cancelled = true
    }
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F97316]/15 via-[#149941]/15 to-[#0B7FB0]/15">
      <p className="text-content-secondary">{message}</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F97316]/15 via-[#149941]/15 to-[#0B7FB0]/15">
          <p className="text-content-secondary">Signing you in...</p>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
