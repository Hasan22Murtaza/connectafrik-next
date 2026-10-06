'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail } from '@/shared/icons'
import { apiClient } from '@/lib/api-client'
import toast from 'react-hot-toast'
import { AuthPageShell } from '@/shared/components/auth/AuthPageShell'

const ForgotPassword: React.FC = () => {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [inlineError, setInlineError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setInlineError('')
    setIsLoading(true)

    try {
      await apiClient.post<{ sent: boolean }>('/api/auth/reset-password', { email })
      toast.success('Verification code sent to your email!')
      router.push(`/verify-otp?email=${encodeURIComponent(email)}&purpose=recovery`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      setInlineError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthPageShell
      title="Reset Password"
      subtitle="Enter your email address and we'll send you a 6-digit verification code"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label htmlFor="email" className="sr-only">
            Email Address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#9CA3AF]" />
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setInlineError('')
              }}
              className="w-full h-12 rounded-xl border border-[#E5E7EB] bg-white pl-11 pr-4 text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition-shadow focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              placeholder="Enter your email address"
              autoComplete="email"
            />
          </div>
          {inlineError && (
            <p className="mt-1.5 text-xs text-red-600" role="alert">
              {inlineError}
            </p>
          )}
        </div>

        <button type="submit" disabled={isLoading} className="flex h-12 min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#F97316] text-sm font-semibold text-white transition-colors hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-50 sm:text-base">
          {isLoading ? (
            'Sending...'
          ) : (
            <>
              Send Verification Code <span aria-hidden="true">→</span>
            </>
          )}
        </button>

        <p className="pt-1 text-center text-sm text-[#6B7280]">
          Remember your password?{' '}
          <Link href="/signin" className="font-medium text-[#22C55E] hover:text-[#16A34A]">
            Sign in
          </Link>
        </p>
      </form>
    </AuthPageShell>
  )
}

export default ForgotPassword
