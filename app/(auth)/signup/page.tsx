'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import toast from 'react-hot-toast'
import { saveSignupMetadata } from '@/lib/auth/clientStorage'
import type { SignupProfileMetadata } from '@/lib/auth/otpTypes'
import { AuthPageShell } from '@/shared/components/auth/AuthPageShell'

const Signup: React.FC = () => {
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    emailOrPhone: '',
    birthday: '',
    gender: '',
    customGender: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const isEmail = (input: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(input)
  }

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return emailRegex.test(email)
  }

  const isValidPhone = (phone: string): boolean => {
    const cleanPhone = phone.replace(/\D/g, '')
    return cleanPhone.length >= 7 && cleanPhone.length <= 15
  }

  const getFormErrors = (): Record<string, string> => {
    const errors: Record<string, string> = {}

    if (!formData.firstName.trim()) errors.firstName = 'First name is required'
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required'

    if (!formData.username || formData.username.trim().length < 3) {
      errors.username = 'Username must be at least 3 characters'
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      errors.username = 'Only letters, numbers, underscores, and hyphens are allowed'
    }

    const input = formData.emailOrPhone.trim()
    if (!input) {
      errors.emailOrPhone = 'Email address is required'
    } else if (isEmail(input)) {
      if (!isValidEmail(input)) {
        errors.emailOrPhone = 'Please enter a valid email address'
      }
    } else if (!isValidPhone(input)) {
      errors.emailOrPhone = 'Please enter a valid email address'
    }

    if (!formData.birthday) errors.birthday = 'Date of Birthday is required'
    if (!formData.gender) errors.gender = 'Gender is required'

    return errors
  }

  const isFormValid = Object.keys(getFormErrors()).length === 0

  const validateForm = (): boolean => {
    const errors = getFormErrors()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      toast.error('Please fix the highlighted fields')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const input = formData.emailOrPhone.trim()
    const isEmailInput = isEmail(input)

    if (!isEmailInput) {
      toast.error('Email signup is required for this flow. Phone signup will be available soon.')
      return
    }

    setIsLoading(true)
    try {
      const profileData: SignupProfileMetadata = {
        username: formData.username,
        first_name: formData.firstName,
        last_name: formData.lastName,
        birthday: formData.birthday,
        gender: formData.gender === 'custom' ? formData.customGender : formData.gender,
        phone_number: null,
        is_phone_registration: false,
      }

      await apiClient.post<{ sent: boolean }>('/api/auth/signup', {
        email: input,
        metadata: profileData,
      })

      saveSignupMetadata(profileData)

      toast.success('Verification code sent to your email!')
      router.push(
        `/verify-otp?email=${encodeURIComponent(input)}&purpose=signup`
      )
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to continue signup'
      if (message.includes('already exists') || message.includes('already taken')) {
        toast.error(message)
        if (message.includes('email')) router.push('/signin')
      } else if (message.includes('rate limit') || message.includes('wait')) {
        toast.error('Too many attempts. Please wait a moment and try again.')
      } else {
        toast.error(message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const maxBirthday = new Date().toISOString().split('T')[0]
  const inputClassName =
    'w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-surface-canvas focus:outline-none focus:border-[#f97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.1)]'

  return (
    <AuthPageShell
      title="Create a new account"
      subtitle="Connect with the African community worldwide"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              placeholder="First name"
              className={inputClassName}
              aria-invalid={!!fieldErrors.firstName}
            />
            {fieldErrors.firstName && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.firstName}</p>
            )}
          </div>
          <div>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              placeholder="Last name"
              className={inputClassName}
              aria-invalid={!!fieldErrors.lastName}
            />
            {fieldErrors.lastName && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.lastName}</p>
            )}
          </div>
        </div>

        <div>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            placeholder="Username"
            className={inputClassName}
            aria-invalid={!!fieldErrors.username}
          />
          {fieldErrors.username && (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.username}</p>
          )}
        </div>

        <div>
          <input
            type="text"
            name="emailOrPhone"
            value={formData.emailOrPhone}
            onChange={handleInputChange}
            placeholder="Email address"
            className={inputClassName}
            aria-invalid={!!fieldErrors.emailOrPhone}
          />
          {fieldErrors.emailOrPhone && (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.emailOrPhone}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center text-xs text-content-secondary mb-1">Date of Birthday</label>
            <input
              type="date"
              name="birthday"
              value={formData.birthday}
              onChange={handleInputChange}
              max={maxBirthday}
              className={inputClassName}
              aria-invalid={!!fieldErrors.birthday}
            />
            {fieldErrors.birthday && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.birthday}</p>
            )}
          </div>

          <div>
            <label className="flex items-center text-xs text-content-secondary mb-1">Gender</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              className={inputClassName}
              aria-invalid={!!fieldErrors.gender}
            >
              <option value="">Select gender</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="custom">Custom</option>
            </select>
            {formData.gender === 'custom' && (
              <input
                type="text"
                name="customGender"
                value={formData.customGender}
                onChange={handleInputChange}
                placeholder="Enter your gender (optional)"
                className={`${inputClassName} mt-2`}
              />
            )}
            {fieldErrors.gender && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.gender}</p>
            )}
          </div>
        </div>

        {/* <div className="space-y-2 pt-2">
          <p className="text-xs text-content-secondary">
            People who use our service may have uploaded your contact information to ConnectAfrik.{' '}
            <Link href="/support" className="text-primary-600 hover:underline">
              Learn more.
            </Link>
          </p>
          <p className="text-xs text-content-secondary">
            By clicking Continue, you agree to our{' '}
            <Link href="/terms-of-service" className="text-primary-600 hover:underline">
              Terms
            </Link>
            ,{' '}
            <Link href="/privacy-policy" className="text-primary-600 hover:underline">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link href="/privacy-policy" className="text-primary-600 hover:underline">
              Cookies Policy
            </Link>
            .
          </p>
        </div> */}

        <button
          type="submit"
          disabled={!isFormValid || isLoading}
          className="w-full btn-primary text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Sending code...' : 'Continue'}
        </button>

        <div className="text-center pt-2">
          <Link href="/signin" className="text-primary-600 hover:underline text-sm font-medium">
            Already have an account?
          </Link>
        </div>
      </form>
    </AuthPageShell>
  )
}

export default Signup
