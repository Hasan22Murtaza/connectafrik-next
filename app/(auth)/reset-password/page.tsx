'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Globe, Eye, EyeOff, Lock, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

const ResetPassword: React.FC = () => {
  const { updatePassword, session, loading: authLoading } = useAuth()
  const router = useRouter()
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    // Check if user has a valid session (from the reset link)
    if (!authLoading && !session) {
      toast.error('Invalid or expired reset link. Please request a new one.')
      router.push('/forgot-password')
    }
  }, [session, authLoading, router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
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
      const { error } = await updatePassword(formData.password)

      if (error) {
        toast.error(error.message)
      } else {
        setIsSuccess(true)
        toast.success('Password updated successfully!')
        
        // Redirect to sign in after 2 seconds
        setTimeout(() => {
          router.push('/signin')
        }, 2000)
      }
    } catch (error: any) {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-african-green/10 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-african-green/10 flex items-center justify-center p-4">
      <div className="max-w-full mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src="/assets/images/logo_2.png" alt="" className="w-30" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isSuccess ? "Password Updated!" : "Set New Password"}
          </h1>
          <p className="text-gray-600">
            {isSuccess
              ? "Your password has been successfully updated"
              : "Enter your new password below"}
          </p>
        </div>

        {/* Form */}
        <div className="card">
          {!isSuccess ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    className="input-field !px-10"
                    placeholder="Enter your new password"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Must be at least 6 characters
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="input-field !px-10"
                    placeholder="Confirm your new password"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Updating Password..." : "Update Password"}
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Password Successfully Updated
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  You can now sign in with your new password.
                </p>
                <p className="text-xs text-gray-500">
                  Redirecting to sign in page...
                </p>
              </div>

              <Link
                href="/signin"
                className="w-full flex justify-center btn-primary py-3 text-base"
              >
                Go to Sign In
              </Link>
            </div>
          )}

          {/* Back to Sign In */}
          {!isSuccess && (
            <div className="mt-6 text-center">
              <Link
                href="/signin"
                className="text-sm text-primary-600 hover:text-primary-500 font-medium"
              >
                Back to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResetPassword

