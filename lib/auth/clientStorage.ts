import type { OtpPurpose, SignupProfileMetadata } from '@/lib/auth/otpTypes'

const VERIFICATION_TOKEN_KEY = 'auth_verification_token'
const VERIFICATION_PURPOSE_KEY = 'auth_verification_purpose'
const VERIFICATION_EMAIL_KEY = 'auth_verification_email'
const PENDING_LOGIN_KEY = 'auth_pending_login'
const SIGNUP_METADATA_KEY = 'auth_signup_metadata'

export type PendingLoginCredentials = {
  email: string
  password: string
}

export function saveVerificationState(params: {
  token: string
  purpose: OtpPurpose
  email: string
}) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(VERIFICATION_TOKEN_KEY, params.token)
  sessionStorage.setItem(VERIFICATION_PURPOSE_KEY, params.purpose)
  sessionStorage.setItem(VERIFICATION_EMAIL_KEY, params.email)
}

export function readVerificationState():
  | { token: string; purpose: OtpPurpose; email: string }
  | null {
  if (typeof window === 'undefined') return null
  const token = sessionStorage.getItem(VERIFICATION_TOKEN_KEY)
  const purpose = sessionStorage.getItem(VERIFICATION_PURPOSE_KEY) as OtpPurpose | null
  const email = sessionStorage.getItem(VERIFICATION_EMAIL_KEY)
  if (!token || !purpose || !email) return null
  return { token, purpose, email }
}

export function clearVerificationState() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(VERIFICATION_TOKEN_KEY)
  sessionStorage.removeItem(VERIFICATION_PURPOSE_KEY)
  sessionStorage.removeItem(VERIFICATION_EMAIL_KEY)
}

export function savePendingLogin(credentials: PendingLoginCredentials) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(PENDING_LOGIN_KEY, JSON.stringify(credentials))
}

export function readPendingLogin(): PendingLoginCredentials | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(PENDING_LOGIN_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PendingLoginCredentials
  } catch {
    return null
  }
}

export function clearPendingLogin() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(PENDING_LOGIN_KEY)
}

export function saveSignupMetadata(metadata: SignupProfileMetadata) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(SIGNUP_METADATA_KEY, JSON.stringify(metadata))
}

export function readSignupMetadata(): SignupProfileMetadata | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(SIGNUP_METADATA_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SignupProfileMetadata
  } catch {
    return null
  }
}

export function clearSignupMetadata() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(SIGNUP_METADATA_KEY)
}
