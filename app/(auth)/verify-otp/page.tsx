'use client'

import React, { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, RefreshCw, CheckCircle, Mail, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api-client'
import { getPostAuthRedirect } from '@/lib/auth/postAuthRedirect'
import { maskEmail } from '@/lib/auth/format'
import type { OtpPurpose } from '@/lib/auth/otpTypes'
import {
  saveVerificationState,
  readPendingLogin,
  clearPendingLogin,
  readSignupMetadata,
} from '@/lib/auth/clientStorage'
import toast from 'react-hot-toast'
import { AuthPageShell } from '@/shared/components/auth/AuthPageShell'
import { OtpInput } from '@/shared/components/auth/OtpInput'

const RESEND_COOLDOWN = 60

const VerifyOTPForm: React.FC = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [purpose, setPurpose] = useState<OtpPurpose | 'phone'>('signup')
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN)
  const [isSuccess, setIsSuccess] = useState(false)
  const [inlineError, setInlineError] = useState('')

  const isPhoneFlow = purpose === 'phone'

  useEffect(() => {
    const phoneParam = searchParams.get('phone')
    const emailParam = searchParams.get('email')
    const purposeParam = searchParams.get('purpose') as OtpPurpose | null

    if (phoneParam) {
      setPhone(decodeURIComponent(phoneParam))
      setPurpose('phone')
      return
    }

    if (emailParam && purposeParam) {
      setEmail(decodeURIComponent(emailParam))
      setPurpose(purposeParam)
      return
    }

    toast.error('Verification details are missing')
    router.push('/signin')
  }, [searchParams, router])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setInlineError('')

    const otpCode = otp.join('')
    if (otpCode.length !== 6) {
      setInlineError('Please enter the complete 6-digit code')
      return
    }

    setIsLoading(true)
    try {
      if (isPhoneFlow) {
        const data = await apiClient.post<{
          user: unknown
          session: { access_token: string; refresh_token: string } | null
        }>('/api/auth/verify-otp', {
          phone,
          token: otpCode,
          type: 'sms',
        })

        if (!data?.session?.access_token || !data?.session?.refresh_token) {
          toast.error('Verification succeeded, but no session was returned.')
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

        setIsSuccess(true)
        toast.success('Verification successful! Welcome back!')
        const redirectTo = searchParams.get('redirect') || '/feed'
        setTimeout(() => {
          window.location.href = redirectTo
        }, 1200)
        return
      }

      const pendingLogin = purpose === 'login' ? readPendingLogin() : null

      const data = await apiClient.post<{
        verified: boolean
        verificationToken?: string
        nextStep?: string
        session?: { access_token: string; refresh_token: string }
        platform_role?: string | null
      }>('/api/auth/verify-email-otp', {
        email,
        token: otpCode,
        purpose,
        password: pendingLogin?.password,
      })

      setIsSuccess(true)
      toast.success('Email verified successfully!')

      if (data.session?.access_token && data.session?.refresh_token) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })

        if (setSessionError) {
          toast.error(setSessionError.message)
          setIsLoading(false)
          return
        }

        clearPendingLogin()
        const redirectTo = getPostAuthRedirect(
          data.platform_role,
          searchParams.get('redirect')
        )
        setTimeout(() => {
          window.location.href = redirectTo
        }, 1200)
        return
      }

      if (data.verificationToken) {
        saveVerificationState({
          token: data.verificationToken,
          purpose: purpose as OtpPurpose,
          email,
        })
      }

      setTimeout(() => {
        if (data.nextStep === 'create-password' || purpose === 'signup' || purpose === 'recovery') {
          router.push(`/create-password?purpose=${purpose}`)
          return
        }

        if (purpose === 'login') {
          clearPendingLogin()
          router.push('/signin')
        }
      }, 1200)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Verification failed'
      if (message.toLowerCase().includes('invalid')) {
        setInlineError('Invalid verification code. Please try again.')
        setOtp(['', '', '', '', '', ''])
        document.getElementById('otp-0')?.focus()
      } else if (message.toLowerCase().includes('expired')) {
        setInlineError('Verification code has expired. Please request a new one.')
      } else if (message.toLowerCase().includes('rate limit')) {
        setInlineError('Too many attempts. Please wait a moment and try again.')
      } else {
        setInlineError(message)
      }
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0 || isResending) return
    setInlineError('')
    setIsResending(true)

    try {
      if (isPhoneFlow) {
        await apiClient.post<{ sent: boolean }>('/api/auth/send-otp', { phone })
      } else if (purpose === 'recovery') {
        await apiClient.post<{ sent: boolean }>('/api/auth/reset-password', { email })
      } else if (purpose === 'signup') {
        const metadata = readSignupMetadata()
        if (!metadata) {
          toast.error('Signup session expired. Please start again.')
          router.push('/signup')
          return
        }
        await apiClient.post<{ sent: boolean }>('/api/auth/signup', {
          email,
          metadata,
        })
      } else {
        await apiClient.post<{ sent: boolean }>('/api/auth/send-email-otp', {
          email,
          purpose: 'login',
        })
      }

      toast.success('Verification code sent!')
      setCountdown(RESEND_COOLDOWN)
      setOtp(['', '', '', '', '', ''])
      document.getElementById('otp-0')?.focus()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to resend code'
      toast.error(message)
    } finally {
      setIsResending(false)
    }
  }

  const handleChangeEmail = () => {
    if (purpose === 'signup') {
      router.push('/signup')
      return
    }
    if (purpose === 'recovery') {
      router.push('/forgot-password')
      return
    }
    router.push('/signin')
  }

  const title = isPhoneFlow
    ? 'Verify Your Phone'
    : purpose === 'recovery'
      ? 'Verify Your Email'
      : 'Verify Your Email'

  const subtitle = isPhoneFlow
    ? `Enter the 6-digit code sent to ${phone.slice(0, 3)}****${phone.slice(-4)}`
    : `Enter the 6-digit code sent to ${maskEmail(email)}`

  if (isSuccess) {
    return (
      <AuthPageShell showLogo={false} title="Verified!" subtitle="Your email has been verified successfully.">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-sm text-content-secondary">Redirecting you to the next step...</p>
        </div>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell showLogo={false} title={title} subtitle={subtitle}>
      <form onSubmit={handleVerify} className="space-y-6">
        <div>
          <label
            htmlFor="otp-0"
            className="block text-sm font-medium text-content mb-3 text-center"
          >
            Verification Code
          </label>
          <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />
          {inlineError && (
            <p className="text-sm text-red-600 text-center mt-3" role="alert">
              {inlineError}
            </p>
          )}
        </div>

        <div className="text-center space-y-2">
          {countdown > 0 ? (
            <p className="text-sm text-content-secondary">Resend code in {countdown}s</p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isResending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Resend OTP
                </>
              )}
            </button>
          )}

          {!isPhoneFlow && (
            <button
              type="button"
              onClick={handleChangeEmail}
              className="block w-full text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Change Email
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || otp.join('').length !== 6}
          className="w-full btn-primary text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Verifying...' : 'Verify'}
        </button>

        <div className="text-center">
          <Link
            href="/signin"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </Link>
        </div>
      </form>

      <div className="mt-6 text-center">
        <p className="text-xs text-content-secondary inline-flex items-center justify-center gap-1">
          {isPhoneFlow ? <Phone className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
          {isPhoneFlow
            ? "Didn't receive the code? Check your SMS messages or try resending."
            : "Didn't receive the code? Check your inbox and spam folder."}
        </p>
      </div>
    </AuthPageShell>
  )
}

const VerifyOTP: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-[#F97316]/15 via-[#149941]/15 to-[#0B7FB0]/15 flex items-center justify-center">
          <p className="text-content-secondary">Loading...</p>
        </div>
      }
    >
      <VerifyOTPForm />
    </Suspense>
  )
}

export default VerifyOTP
