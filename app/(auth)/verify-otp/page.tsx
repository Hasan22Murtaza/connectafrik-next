'use client'

import React, { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Phone, ArrowLeft, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const VerifyOTPForm: React.FC = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [phone, setPhone] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    const phoneParam = searchParams.get('phone')
    if (phoneParam) {
      setPhone(decodeURIComponent(phoneParam))
    } else {
      toast.error('Phone number is required')
      router.push('/signin')
    }
  }, [searchParams, router])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return // Only allow single digit
    
    const newOtp = [...otp]
    newOtp[index] = value.replace(/\D/g, '') // Only allow digits
    
    setOtp(newOtp)

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      nextInput?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      prevInput?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newOtp = [...otp]
    
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pastedData[i] || ''
    }
    
    setOtp(newOtp)
    
    // Focus the last filled input or the last input
    const lastFilledIndex = Math.min(pastedData.length, 5)
    const nextInput = document.getElementById(`otp-${lastFilledIndex}`)
    nextInput?.focus()
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const otpCode = otp.join('')
    
    if (otpCode.length !== 6) {
      toast.error('Please enter the complete 6-digit code')
      return
    }

    if (!phone) {
      toast.error('Phone number is required')
      router.push('/signin')
      return
    }

    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phone,
        token: otpCode,
        type: 'sms'
      })

      if (error) {
        console.error('OTP verification error:', error)
        if (error.message?.includes('Invalid') || error.message?.includes('invalid')) {
          toast.error('Invalid verification code. Please try again.')
          setOtp(['', '', '', '', '', ''])
          document.getElementById('otp-0')?.focus()
        } else if (error.message?.includes('expired')) {
          toast.error('Verification code has expired. Please request a new one.')
          setOtp(['', '', '', '', '', ''])
        } else if (error.message?.includes('rate limit')) {
          toast.error('Too many attempts. Please wait a moment and try again.')
        } else {
          const errorMsg = error.message || 'Failed to verify code'
          toast.error(errorMsg)
        }
        setIsLoading(false)
      } else {
        console.log('OTP verification success:', data)
        toast.success('Verification successful! Welcome back!')
        
        // Wait for session to be set in cookies before redirecting
        const redirectTo = searchParams.get('redirect') || '/feed'
        setTimeout(() => {
          // Use window.location for full page reload to ensure middleware can read cookies
          window.location.href = redirectTo
        }, 200)
      }
    } catch (error: any) {
      console.error('OTP verification exception:', error)
      toast.error('An unexpected error occurred')
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0) return

    if (!phone) {
      toast.error('Phone number is required')
      return
    }

    setIsResending(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phone
      })

      if (error) {
        console.error('Resend OTP error:', error)
        if (error.message?.includes('rate limit')) {
          toast.error('Too many attempts. Please wait a moment and try again.')
          setCountdown(60)
        } else {
          toast.error('Failed to resend code. Please try again.')
        }
      } else {
        toast.success('Verification code sent!')
        setCountdown(60)
        setOtp(['', '', '', '', '', ''])
        document.getElementById('otp-0')?.focus()
      }
    } catch (error: any) {
      console.error('Resend OTP exception:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setIsResending(false)
    }
  }

  // Format phone number for display
  const formatPhone = (phoneNumber: string) => {
    if (!phoneNumber) return ''
    // Mask middle digits for privacy
    if (phoneNumber.length > 7) {
      const start = phoneNumber.slice(0, 3)
      const end = phoneNumber.slice(-4)
      return `${start}****${end}`
    }
    return phoneNumber
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F97316]/15 via-[#149941]/15 to-[#0B7FB0]/15 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Link href={"/"}>
              <img src="/assets/images/logo_2.png" alt="" className="w-30" />
            </Link>
          </div>
          <h1 className="sm:text-3xl text-2xl font-bold text-gray-900 mb-2">
            Verify Your Phone
          </h1>
          <p className="text-gray-600 sm:text-base text-sm">
            Enter the 6-digit code sent to {formatPhone(phone)}
          </p>
        </div>

        {/* Form */}
        <div className="card">
          <form onSubmit={handleVerify} className="space-y-6">
            {/* OTP Input */}
            <div>
              <label
                htmlFor="otp-0"
                className="block text-sm font-medium text-gray-700 mb-3 text-center"
              >
                Verification Code
              </label>
              <div className="flex justify-center gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    className="w-12 h-14 text-center text-2xl font-semibold border-2 border-gray-300 rounded-lg focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-200 transition-colors"
                    autoFocus={index === 0}
                  />
                ))}
              </div>
            </div>

            {/* Resend Code */}
            <div className="text-center">
              {countdown > 0 ? (
                <p className="text-sm text-gray-500">
                  Resend code in {countdown}s
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
                >
                  {isResending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Resend Code
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || otp.join('').length !== 6}
              className="w-full btn-primary text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Verifying..." : "Verify Code"}
            </button>

            {/* Back to Sign In */}
            <div className="text-center">
              <Link
                href="/signin"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </Link>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Didn't receive the code? Check your SMS messages or try resending.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const VerifyOTP: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#F97316]/15 via-[#149941]/15 to-[#0B7FB0]/15 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <VerifyOTPForm />
    </Suspense>
  )
}

export default VerifyOTP

