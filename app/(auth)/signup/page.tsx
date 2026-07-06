'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import toast from 'react-hot-toast'
import { LocationSearch } from '@/shared/components/ui/LocationSearch'

const Signup: React.FC = () => {
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    emailOrPhone: '',
    password: '',
    birthday: '',
    gender: '',
    customGender: '',
    formattedAddress: '',
    address: '',
    city: '',
    state: '',
    zipcode: '',
    country: '',
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

    if (!formData.birthday) {
      toast.error('Please enter your birthday')
      return
    }

    if (!formData.gender) {
      toast.error('Please select your gender')
      return
    }

    if (!formData.formattedAddress.trim() || !formData.country) {
      toast.error('Choose your location from the search suggestions')
      return
    }

    setIsLoading(true)
    try {
      // Profile data to pass to verification page
      const profileData = {
        username: formData.username,
        first_name: formData.firstName,
        last_name: formData.lastName,
        birthday: formData.birthday,
        gender: formData.gender === 'custom' ? formData.customGender : formData.gender,
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        zipcode: formData.zipcode.trim() || null,
        country: formData.country,
      }

      if (isEmailInput) {
        try {
          await apiClient.post<{ user: any; session: any }>('/api/auth/signup', {
            email: input,
            password: formData.password,
            metadata: {
              ...profileData,
              phone_number: null,
              is_phone_registration: false
            }
          })

          toast.success('Account created successfully! Please check your email to verify your account.')
          router.push('/signin')
        } catch (error: any) {
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
        }
      } else {
        // Phone signup - use Supabase Phone Auth with OTP
        const cleanPhone = input.trim()

        // Validate phone format (should start with + for international)
        if (!cleanPhone.startsWith('+')) {
          toast.error('Phone number must include country code (e.g., +1234567890)')
          return
        }

        try {
          await apiClient.post<{ sent: boolean }>('/api/auth/send-otp', {
            phone: cleanPhone,
            data: {
              ...profileData,
              phone_number: cleanPhone,
              is_phone_registration: true
            }
          })

          toast.success('Verification code sent to your phone!')
          router.push('/signin')
        } catch (error: any) {
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
        }
      }
    } catch (error: any) {
      console.error('Signup exception:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const maxBirthday = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F97316]/15 via-[#149941]/15 to-[#0B7FB0]/15  flex items-center justify-center p-4">
      <div className="flex-1 flex items-center justify-center py-8">
        <div className="max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center mb-4">
            <Link href={"/"}>
            <img src="/assets/images/logo_2.png" alt="" className="w-30" />
            </Link>
          </div>
            <h1 className="sm:text-3xl text-2xl font-bold text-content mb-2">
              Create a new account
            </h1>
            <p className="text-content-secondary sm:text-base text-sm">
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
                    className=" w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-surface-canvas focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
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
                    className=" w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-surface-canvas focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
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
                  className=" w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-surface-canvas focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
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
                  className=" w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-surface-canvas focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
                  required
                />
              
              </div>

              {/* Password */}
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="New password"
                  className=" w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-surface-canvas focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)] pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-secondary hover:text-content"
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
                <label className="flex items-center text-xs text-content-secondary mb-1">
                  Birthday
                </label>
                <input
                  type="date"
                  name="birthday"
                  value={formData.birthday}
                  onChange={handleInputChange}
                  max={maxBirthday}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-surface-canvas focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
                  required
                />
              </div>

              {/* Gender */}
              <div>
                <label className="flex items-center text-xs text-content-secondary mb-1">
                  Gender
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-surface-canvas focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
                  required
                >
                  <option value="">Select gender</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="custom">Custom</option>
                </select>
                {formData.gender === "custom" && (
                  <input
                    type="text"
                    name="customGender"
                    value={formData.customGender}
                    onChange={handleInputChange}
                    placeholder="Enter your gender (optional)"
                    className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-surface-canvas focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
                  />
                )}
              </div>

              <LocationSearch
                label="Location"
                required
                value={{
                  formattedAddress: formData.formattedAddress,
                  address: formData.address,
                  city: formData.city,
                  state: formData.state,
                  zipcode: formData.zipcode,
                  country: formData.country,
                }}
                onChange={(loc) =>
                  setFormData((prev) => ({
                    ...prev,
                    formattedAddress: loc.formattedAddress,
                    address: loc.address,
                    city: loc.city,
                    state: loc.state,
                    zipcode: loc.zipcode,
                    country: loc.country,
                  }))
                }
                fieldClassName="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-surface-canvas focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]"
              />

              {/* Policy Text */}
              <div className="space-y-2 pt-2">
                <p className="text-xs text-content-secondary">
                  People who use our service may have uploaded your contact
                  information to ConnectAfrik.{" "}
                  <Link
                    href="/support"
                    className="text-primary-600 hover:underline"
                  >
                    Learn more.
                  </Link>
                </p>
                <p className="text-xs text-content-secondary">
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
                className="w-full btn-primary text-base disabled:opacity-50 disabled:cursor-not-allowed"
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

