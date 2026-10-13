'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect } from 'react'

/** Registers this browser as a Signal device once the user is signed in. */
export function E2eeBootstrap() {
  const { user } = useAuth()
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    void import('@/lib/e2ee/client')
      .then((mod) => {
        if (!cancelled) return mod.ensureDevice()
        return null
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [user?.id])
  return null
}
