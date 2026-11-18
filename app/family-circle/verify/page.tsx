'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
function VerifyInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('Verifying…')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Missing verification token.')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        // Public token endpoint — no auth required (email links may open logged out).
        const response = await fetch('/api/family/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const body = await response.json().catch(() => ({}))
        if (cancelled) return
        if (!response.ok || body.success === false) {
          setStatus('error')
          setMessage(body?.message || 'Verification failed.')
          return
        }
        setStatus('ok')
        setMessage(body?.data?.message || body?.message || 'Request verified successfully.')
      } catch {
        if (cancelled) return
        setStatus('error')
        setMessage('Verification failed.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-content">Family verification</h1>
      <p className="mt-3 text-sm text-content-secondary">{message}</p>
      {status !== 'loading' ? (
        <Link
          href="/family-circle"
          className="mt-6 inline-flex rounded-[14px] bg-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          Back to Family Circle
        </Link>
      ) : null}
    </div>
  )
}

export default function FamilyVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-content-secondary">
          Loading…
        </div>
      }
    >
      <VerifyInner />
    </Suspense>
  )
}
