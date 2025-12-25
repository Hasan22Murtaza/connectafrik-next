'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Logo from '@/shared/components/ui/Logo'
import Footer from '@/shared/components/layout/FooterNext'
import toast from 'react-hot-toast'

const Signup: React.FC = () => {
  const { signUp } = useAuth()
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    emailOrPhone: '',
    password: '',
    birthMonth: '',
    birthDay: '',
    birthYear: '',
    gender: '',
    customGender: '',
    country: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Helper function to detect if input is email or phone
  const isEmail = (input: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(input)
  }

  // Helper function to validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return emailRegex.test(email)
  }

  // Helper function to validate phone format
  const isValidPhone = (phone: string): boolean => {
    // Remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '')
    // Check if it's a valid phone number (7-15 digits)
    return cleanPhone.length >= 7 && cleanPhone.length <= 15
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.firstName || !formData.lastName) {
      toast.error('Please enter your first and last name')
      return
    }

    if (!formData.username || formData.username.trim().length < 3) {
      toast.error('Please enter a username (at least 3 characters)')
      return
    }

    // Check username format (alphanumeric, underscores, hyphens only)
    if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      toast.error('Username can only contain letters, numbers, underscores, and hyphens')
      return
    }

    if (!formData.emailOrPhone) {
      toast.error('Please enter your mobile number or email')
      return
    }

    // Smart email/phone validation
    const input = formData.emailOrPhone.trim()
    const isEmailInput = isEmail(input)
    
    if (isEmailInput) {
      // Validate email format
      if (!isValidEmail(input)) {
        toast.error('Please enter a valid email address (e.g., user@example.com)')
        return
      }
    } else {
      // Validate phone format
      if (!isValidPhone(input)) {
        toast.error('Please enter a valid phone number (e.g., +1234567890 or 1234567890)')
        return
      }
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }

    if (!formData.birthMonth || !formData.birthDay || !formData.birthYear) {
      toast.error('Please enter your complete birthday')
      return
    }

    if (!formData.gender) {
      toast.error('Please select your gender')
      return
    }

    if (!formData.country) {
      toast.error('Please select your location')
      return
    }

    setIsLoading(true)
    try {
      // Construct birthday
      const birthday = `${formData.birthYear}-${formData.birthMonth.padStart(2, '0')}-${formData.birthDay.padStart(2, '0')}`

      // Profile data to pass to verification page
      const profileData = {
        username: formData.username,
        first_name: formData.firstName,
        last_name: formData.lastName,
        birthday: birthday,
        gender: formData.gender === 'custom' ? formData.customGender : formData.gender,
        country: formData.country
      }

      if (isEmailInput) {
        // Email signup - use Supabase signUp with metadata
        const { data, error } = await supabase.auth.signUp({
          email: input,
          password: formData.password,
          options: {
            data: {
              ...profileData,
              phone_number: null,
              is_phone_registration: false
            }
          }
        })

        if (error) {
          console.error('Email signup error:', error)
          if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
            toast.error('An account with this email already exists. Please sign in instead.')
            router.push('/signin')
          } else if (error.message?.includes('Invalid email') || error.message?.includes('invalid email')) {
            toast.error('Please enter a valid email address (e.g., user@example.com)')
          } else if (error.message?.includes('Password should be at least')) {
            toast.error('Password must be at least 8 characters long.')
          } else if (error.message?.includes('rate limit')) {
            toast.error('Too many attempts. Please wait a moment and try again.')
          } else if (error.message?.includes('network') || error.message?.includes('connection')) {
            toast.error('Network error. Please check your connection and try again.')
          } else {
            const errorMsg = error.message || 'Failed to create account'
            toast.error(errorMsg)
          }
        } else {
          console.log('Email signup success:', data)
          toast.success('Account created successfully! Please check your email to verify your account.')
          router.push('/signin')
        }
      } else {
        // Phone signup - use Supabase Phone Auth with OTP
        const cleanPhone = input.trim()

        // Validate phone format (should start with + for international)
        if (!cleanPhone.startsWith('+')) {
          toast.error('Phone number must include country code (e.g., +1234567890)')
          return
        }

        // Send OTP via Supabase Phone Auth
        const { data, error } = await supabase.auth.signInWithOtp({
          phone: cleanPhone,
          options: {
            data: {
              ...profileData,
              phone_number: cleanPhone,
              is_phone_registration: true
            }
          }
        })

        if (error) {
          console.error('Phone OTP error:', error)
          if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
            toast.error('An account with this phone number already exists. Please sign in instead.')
            router.push('/signin')
          } else if (error.message?.includes('Invalid phone') || error.message?.includes('invalid phone')) {
            toast.error('Please enter a valid phone number with country code (e.g., +1234567890)')
          } else if (error.message?.includes('rate limit')) {
            toast.error('Too many attempts. Please wait a moment and try again.')
          } else if (error.message?.includes('Phone Provider not enabled')) {
            toast.error('Phone authentication is not enabled. Please use email signup or contact support.')
          } else {
            const errorMsg = error.message || 'Failed to send verification code'
            toast.error(errorMsg)
          }
        } else {
          console.log('Phone OTP sent:', data)
          toast.success('Verification code sent to your phone!')

          // Navigate to OTP verification page (if it exists)
          // For now, redirect to signin - you may need to create a verify-otp page
          router.push('/signin')
        }
      }
    } catch (error: any) {
      console.error('Signup exception:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Generate arrays for date dropdowns
  const months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' },
    { value: '3', label: 'March' }, { value: '4', label: 'April' },
    { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' },
    { value: '9', label: 'September' }, { value: '10', label: 'October' },
    { value: '11', label: 'November' }, { value: '12', label: 'December' }
  ]

  const days = Array.from({ length: 31 }, (_, i) => i + 1)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 120 }, (_, i) => currentYear - i)

  const locations = [
    // African Countries
    'Ghana', 'Nigeria', 'Kenya', 'South Africa', 'Ethiopia', 'Egypt',
    'Tanzania', 'Uganda', 'Algeria', 'Morocco', 'Angola', 'Sudan',
    'Mozambique', 'Madagascar', 'Cameroon', 'Ivory Coast', 'Niger',
    'Burkina Faso', 'Mali', 'Malawi', 'Zambia', 'Senegal', 'Somalia',
    'Chad', 'Zimbabwe', 'Guinea', 'Rwanda', 'Benin', 'Tunisia',
    'Burundi', 'Togo', 'Sierra Leone', 'Libya', 'Liberia', 'Mauritania',
    'Congo', 'Namibia', 'Botswana', 'Gabon', 'Gambia', 'Guinea-Bissau',
    'Equatorial Guinea', 'Mauritius', 'Eswatini', 'Djibouti', 'Comoros',
    'Cape Verde', 'São Tomé and Príncipe', 'Seychelles',
    // Other Regions & Countries
    'United States of America', 'United Kingdom', 'France', 'Germany',
    'Australia', 'India', 'China', 'Europe', 'Asia', 'Caribbean', 'Other'
  ].sort()

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F97316]/15 via-[#149941]/15 to-[#0B7FB0]/15  flex items-center justify-center p-4">
      <div className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="max-w-md w-full px-4">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center mb-3">
              <img src="/assets/images/logo_2.png" alt="" className="w-30" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Create a new account
            </h1>
            <p className="text-gray-600">
              Connect with the African community worldwide
            </p>
          </div>

          {/* Form Card */}
          <div className="card">
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* First Name and Last Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="First name"
                    className=" w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
                    required
                  />
                </div>
                <div>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Last name"
                    className=" w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
                    required
                  />
                </div>
              </div>

              {/* Username */}
              <div>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Username"
                  className=" w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
                  required
                />
              </div>

              {/* Mobile number or email */}
              <div>
                <input
                  type="text"
                  name="emailOrPhone"
                  value={formData.emailOrPhone}
                  onChange={handleInputChange}
                  placeholder="Mobile number or email"
                  className=" w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter your email (user@example.com) or phone number
                  (+1234567890)
                </p>
              </div>

              {/* Password */}
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="New password"
                  className=" w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)] pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Birthday */}
              <div>
                <label className="flex items-center text-xs text-gray-600 mb-1">
                  Birthday
                  <span
                    className="ml-1 text-gray-400 cursor-help"
                    title="Provide your date of birth"
                  >
                    ⓘ
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    name="birthMonth"
                    value={formData.birthMonth}
                    onChange={handleInputChange}
                    className=" w-full p-2  border border-gray-300 rounded-md text-sm bg-gray-50 focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
                    required
                  >
                    <option value="">Month</option>
                    {months.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                  <select
                    name="birthDay"
                    value={formData.birthDay}
                    onChange={handleInputChange}
                    className=" w-full p-2 border border-gray-300 rounded-md text-sm bg-gray-50 focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
                    required
                  >
                    <option value="">Day</option>
                    {days.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                  <select
                    name="birthYear"
                    value={formData.birthYear}
                    onChange={handleInputChange}
                    className=" w-full p-2 border border-gray-300 rounded-md text-sm bg-gray-50 focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
                    required
                  >
                    <option value="">Year</option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="flex items-center text-xs text-gray-600 mb-1">
                  Gender
                  <span
                    className="ml-1 text-gray-400 cursor-help"
                    title="Select your gender"
                  >
                    ⓘ
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <label className="flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={formData.gender === "female"}
                      onChange={handleInputChange}
                      className="mr-2 text-primary-600 focus:ring-primary-500"
                      required
                    />
                    Female
                  </label>
                  <label className="flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={formData.gender === "male"}
                      onChange={handleInputChange}
                      className="mr-2 text-primary-600 focus:ring-primary-500"
                      required
                    />
                    Male
                  </label>
                  <label className="flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="gender"
                      value="custom"
                      checked={formData.gender === "custom"}
                      onChange={handleInputChange}
                      className="mr-2 text-primary-600 focus:ring-primary-500"
                      required
                    />
                    Custom
                  </label>
                </div>
                {formData.gender === "custom" && (
                  <input
                    type="text"
                    name="customGender"
                    value={formData.customGender}
                    onChange={handleInputChange}
                    placeholder="Enter your gender (optional)"
                    className=" w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
                  />
                )}
              </div>

              {/* Country */}
              <div>
                <select
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  className=" w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
                  required
                >
                  <option value="">Select your location</option>
                  {locations.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>

              {/* Policy Text */}
              <div className="space-y-2 pt-2">
                <p className="text-xs text-gray-500">
                  People who use our service may have uploaded your contact
                  information to ConnectAfrik.{" "}
                  <Link
                    href="/support"
                    className="text-primary-600 hover:underline"
                  >
                    Learn more.
                  </Link>
                </p>
                <p className="text-xs text-gray-500">
                  By clicking Sign Up, you agree to our{" "}
                  <Link
                    href="/terms-of-service"
                    className="text-primary-600 hover:underline"
                  >
                    Terms
                  </Link>
                  ,{" "}
                  <Link
                    href="/privacy-policy"
                    className="text-primary-600 hover:underline"
                  >
                    Privacy Policy
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy-policy"
                    className="text-primary-600 hover:underline"
                  >
                    Cookies Policy
                  </Link>
                  . You may receive SMS Notifications from us and can opt out
                  any time.
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Creating account..." : "Sign Up"}
              </button>

              {/* Sign In Link */}
              <div className="text-center pt-2">
                <Link
                  href="/signin"
                  className="text-primary-600 hover:underline text-sm font-medium"
                >
                  Already have an account?
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup

