'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

/**
 * Supabase email confirmation redirects to the site URL with tokens in the hash
 * (#access_token=...&type=signup&...). Show a confirmation toast and send the user
 * to sign-in. Other hash types (e.g. recovery) are left for their own flows.
 */
export default function SignupEmailConfirmHandler() {
  const router = useRouter()
  const handled = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || handled.current) return

    const raw = window.location.hash.replace(/^#/, '')
    if (!raw || !raw.includes('access_token=')) return

    const params = new URLSearchParams(raw)
    const accessToken = params.get('access_token')
    const type = params.get('type')

    if (!accessToken || type !== 'signup') return

    handled.current = true

    const cleanPath = window.location.pathname + window.location.search
    window.history.replaceState(null, '', cleanPath)

    void (async () => {
      await supabase.auth.signOut()
      toast.success('Your account is activated.')
      router.replace('/signin')
    })()
  }, [router])

  return null
}
