'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail } from 'lucide-react'
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
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-content mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary w-5 h-5" />
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
              className="input-field !pl-10"
              placeholder="Enter your email"
            />
          </div>
          {inlineError && (
            <p className="text-sm text-red-600 mt-2" role="alert">
              {inlineError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full btn-primary text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Sending...' : 'Send Verification Code'}
        </button>

        <div className="text-center">
          <p className="text-sm text-content-secondary">
            Remember your password?{' '}
            <Link href="/signin" className="text-primary-600 hover:text-primary-500 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </AuthPageShell>
  )
}

export default ForgotPassword
