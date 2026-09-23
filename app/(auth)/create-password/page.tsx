'use client'

import React, { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Lock, CheckCircle } from '@/shared/icons'
import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api-client'
import { getPostAuthRedirect } from '@/lib/auth/postAuthRedirect'
import { validatePasswordPair } from '@/lib/auth/password'
import {
  readVerificationState,
  clearVerificationState,
  clearSignupMetadata,
} from '@/lib/auth/clientStorage'
import type { OtpPurpose } from '@/lib/auth/otpTypes'
import toast from 'react-hot-toast'
import { AuthPageShell } from '@/shared/components/auth/AuthPageShell'
import { PasswordStrengthMeter } from '@/shared/components/auth/PasswordStrengthMeter'

const CreatePasswordForm: React.FC = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [inlineError, setInlineError] = useState('')
  const [purpose, setPurpose] = useState<OtpPurpose>('signup')
  const [verificationToken, setVerificationToken] = useState('')

  useEffect(() => {
    const purposeParam = (searchParams.get('purpose') as OtpPurpose) || 'signup'
    const state = readVerificationState()

    if (!state?.token) {
      toast.error('Your verification session has expired. Please start again.')
      router.push(purposeParam === 'recovery' ? '/forgot-password' : '/signup')
      return
    }

    setPurpose(state.purpose)
    setVerificationToken(state.token)
  }, [router, searchParams])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setInlineError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validatePasswordPair(formData.password, formData.confirmPassword)
    if (validationError) {
      setInlineError(validationError)
      return
    }

    if (!verificationToken) {
      setInlineError('Verification session expired. Please start again.')
      return
    }

    setIsLoading(true)
    try {
      const endpoint =
        purpose === 'recovery'
          ? '/api/auth/reset-password/complete'
          : '/api/auth/signup/complete'

      const data = await apiClient.post<{
        user: unknown
        session: { access_token: string; refresh_token: string }
        platform_role?: string | null
      }>(endpoint, {
        verificationToken,
        password: formData.password,
      })

      if (!data?.session?.access_token || !data?.session?.refresh_token) {
        toast.error('Account created, but no session was returned.')
        setIsLoading(false)
        return
      }

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })

      if (setSessionError) {
        toast.error(setSessionError.message)
        setIsLoading(false)
        return
      }

      clearVerificationState()
      clearSignupMetadata()
      setIsSuccess(true)
      toast.success(
        purpose === 'recovery'
          ? 'Password updated successfully!'
          : 'Welcome to CribsTalk!'
      )

      const redirectTo = getPostAuthRedirect(data.platform_role, '/feed')
      setTimeout(() => {
        window.location.href = redirectTo
      }, 1200)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save password'
      setInlineError(message)
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <AuthPageShell
        title={purpose === 'recovery' ? 'Password Updated!' : 'Account Created!'}
        subtitle="You're all set. Redirecting you now..."
      >
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell
      title={purpose === 'recovery' ? 'Create New Password' : 'Create Password'}
      subtitle={
        purpose === 'recovery'
          ? 'Choose a strong password for your account'
          : 'Set a secure password to complete your registration'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#9CA3AF]" />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={formData.password}
              onChange={handleInputChange}
              className="w-full h-12 rounded-xl border border-[#E5E7EB] bg-white pl-11 pr-11 text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition-shadow focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              placeholder="Enter your password"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer text-[#9CA3AF] hover:text-[#6B7280]"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <div className="mt-3">
            <PasswordStrengthMeter password={formData.password} />
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="sr-only">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#9CA3AF]" />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className="w-full h-12 rounded-xl border border-[#E5E7EB] bg-white pl-11 pr-11 text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition-shadow focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              placeholder="Confirm your password"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer text-[#9CA3AF] hover:text-[#6B7280]"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {inlineError && (
          <p className="mt-1.5 text-xs text-red-600" role="alert">
            {inlineError}
          </p>
        )}

        <button type="submit" disabled={isLoading} className="flex h-12 min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#F97316] text-sm font-semibold text-white transition-colors hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-50 sm:text-base">
          {isLoading ? (
            'Saving...'
          ) : (
            <>
              {purpose === 'recovery' ? 'Reset Password' : 'Complete Registration'}{' '}
              <span aria-hidden="true">→</span>
            </>
          )}
        </button>

        <p className="pt-1 text-center text-sm text-[#6B7280]">
          <Link href="/signin" className="font-medium text-[#22C55E] hover:text-[#16A34A]">
            Back to Sign In
          </Link>
        </p>
      </form>
    </AuthPageShell>
  )
}

const CreatePassword: React.FC = () => {
  return (
    <Suspense
      fallback={
        <AuthPageShell title="Create Password" subtitle="Loading...">
          <p className="text-center text-sm text-content-secondary">Loading...</p>
        </AuthPageShell>
      }
    >
      <CreatePasswordForm />
    </Suspense>
  )
}

export default CreatePassword
