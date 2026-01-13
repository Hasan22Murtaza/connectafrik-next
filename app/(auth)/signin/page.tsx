'use client'

import React, { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Globe, Eye, EyeOff, Mail, Lock, Phone } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

const SigninForm: React.FC = () => {
  const { signIn } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    phone: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setIsLoading(true)
    try {
      if (loginMethod === 'email') {
        // Email/Password login
        const { error } = await signIn(formData.email, formData.password)

        if (error) {
          toast.error(error.message)
          setIsLoading(false)
        } else {
          toast.success('Welcome back!')
          // Wait for session to be set in cookies before redirecting
          // Use a small delay to ensure cookies are properly set
          const redirectTo = searchParams.get('redirect') || '/feed'
          setTimeout(() => {
            // Use window.location for full page reload to ensure middleware can read cookies
            window.location.href = redirectTo
          }, 200)
        }
      } else {
        // Phone/OTP login
        const cleanPhone = formData.phone.trim()

        // Validate phone format (should start with + for international)
        if (!cleanPhone || !cleanPhone.startsWith('+')) {
          toast.error('Phone number must include country code (e.g., +1234567890)')
          setIsLoading(false)
          return
        }

        // Send OTP via Supabase Phone Auth
        const { data, error } = await supabase.auth.signInWithOtp({
          phone: cleanPhone
        })

        if (error) {
          console.error('Phone OTP error:', error)
          if (error.message?.includes('Invalid phone') || error.message?.includes('invalid phone')) {
            toast.error('Please enter a valid phone number with country code (e.g., +1234567890)')
          } else if (error.message?.includes('rate limit')) {
            toast.error('Too many attempts. Please wait a moment and try again.')
          } else if (error.message?.includes('Phone Provider not enabled')) {
            toast.error('Phone authentication is not enabled. Please use email signin or contact support.')
          } else if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
            toast.error('No account found with this phone number. Please sign up first.')
          } else {
            const errorMsg = error.message || 'Failed to send verification code'
            toast.error(errorMsg)
          }
          setIsLoading(false)
        } else {
          console.log('Phone OTP sent:', data)
          toast.success('Verification code sent to your phone!')
          // Navigate to OTP verification page with phone number
          router.push(`/verify-otp?phone=${encodeURIComponent(cleanPhone)}&redirect=${encodeURIComponent(searchParams.get('redirect') || '/feed')}`)
        }
      }
    } catch (error: any) {
      toast.error('An unexpected error occurred')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F97316]/15 via-[#149941]/15 to-[#0B7FB0]/15  flex items-center justify-center p-4">
      <div className="max-w-md w-full ">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Link href={"/"}>
            <img src="/assets/images/logo_2.png" alt="" className="w-30" />
            </Link>
          </div>
          <h1 className="sm:text-3xl text-2xl font-bold text-gray-900 mb-2">
            Welcome Back
          </h1>
          <p className="text-gray-600 sm:text-base text-sm">
            Sign in to continue your journey with ConnectAfrik
          </p>
        </div>

        {/* Form */}
        <div className="card ">
          {/* Login Method Toggle */}
          <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => setLoginMethod('email')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                loginMethod === 'email'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod('phone')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                loginMethod === 'phone'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Phone
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-2">
            {loginMethod === 'email' ? (
              <>
                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className="input-field !pl-10"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Password
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
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600  cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label
                      htmlFor="remember-me"
                      className="ml-2 block text-sm text-gray-700"
                    >
                      Remember me
                    </label>
                  </div>
                  <div className="text-sm">
                    <Link
                      href="/forgot-password"
                      className="font-medium text-primary-600 hover:text-primary-500"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Phone */}
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Phone Number
                  </label>
                  <div className="[&_.PhoneInputInput]:input-field [&_.PhoneInputInput]:w-full">
                    <PhoneInput
                      international
                      defaultCountry="GH"
                      value={formData.phone}
                      onChange={(value) => setFormData(prev => ({ ...prev, phone: value || '' }))}
                      placeholder="Enter your phone number"
                      numberInputProps={{
                        required: true
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    We'll send you a verification code via SMS
                  </p>
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary  text-base disabled:opacity-50"
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  New to ConnectAfrik?
                </span>
              </div>
            </div>
          </div>

          {/* Sign Up Link */}
          <div>
            <Link href="/signup" className="btn-secondary w-full">
              Create New Account
            </Link>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Join thousands of Africans sharing their stories, culture, and
              political insights
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const Signin: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#F97316]/15 via-[#149941]/15 to-[#0B7FB0]/15 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SigninForm />
    </Suspense>
  )
}

export default Signin

