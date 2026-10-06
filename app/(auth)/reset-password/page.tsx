'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, CheckCircle } from '@/shared/icons'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'
import toast from 'react-hot-toast'
import { AuthPageShell } from '@/shared/components/auth/AuthPageShell'

const ResetPassword: React.FC = () => {
  const { session, loading: authLoading } = useAuth()
  const router = useRouter()
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    if (!authLoading && !session) {
      toast.error('Invalid or expired reset link. Please request a new one.')
      router.push('/forgot-password')
    }
  }, [session, authLoading, router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)
    try {
      await apiClient.post<{ updated: boolean }>('/api/auth/update-password', {
        password: formData.password,
      })

      setIsSuccess(true)
      toast.success('Password updated successfully!')

      setTimeout(() => {
        router.push('/signin')
      }, 2000)
    } catch (error: any) {
      toast.error(error.message || 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading) {
    return (
      <AuthPageShell title="Set New Password" subtitle="Loading your session...">
        <div className="py-6 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-[#F97316]" />
          <p className="mt-4 text-sm text-[#6B7280]">Loading...</p>
        </div>
      </AuthPageShell>
    )
  }

  if (!session) {
    return null
  }

  return (
    <AuthPageShell
      title={isSuccess ? 'Password Updated!' : 'Set New Password'}
      subtitle={
        isSuccess
          ? 'Your password has been successfully updated'
          : 'Enter your new password below'
      }
    >
      {!isSuccess ? (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="password" className="sr-only">
              New Password
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
                placeholder="Enter your new password"
                minLength={6}
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
            <p className="mt-1.5 text-xs text-[#6B7280]">Must be at least 6 characters</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="sr-only">
              Confirm New Password
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
                placeholder="Confirm your new password"
                minLength={6}
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

          <button type="submit" disabled={isLoading} className="flex h-12 min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#F97316] text-sm font-semibold text-white transition-colors hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-50 sm:text-base">
            {isLoading ? (
              'Updating Password...'
            ) : (
              <>
                Update Password <span aria-hidden="true">→</span>
              </>
            )}
          </button>

          <p className="pt-1 text-center text-sm text-[#6B7280]">
            <Link href="/signin" className="font-medium text-[#22C55E] hover:text-[#16A34A]">
              Back to Sign In
            </Link>
          </p>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-[#111827]">
              Password Successfully Updated
            </h3>
            <p className="mb-2 text-sm text-[#6B7280]">
              You can now sign in with your new password.
            </p>
            <p className="text-xs text-[#6B7280]">Redirecting to sign in page...</p>
          </div>

          <Link href="/signin" className="flex h-12 min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#F97316] text-sm font-semibold text-white transition-colors hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-50 sm:text-base">
            Go to Sign In
          </Link>
        </div>
      )}
    </AuthPageShell>
  )
}

export default ResetPassword
