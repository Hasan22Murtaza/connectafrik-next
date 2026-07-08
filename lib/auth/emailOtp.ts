import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OtpPurpose, SignupProfileMetadata, VerificationTokenPayload } from './otpTypes'

const OTP_LENGTH = 6
const OTP_TTL_MS = 10 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const MAX_SENDS_PER_WINDOW = 3
const SEND_WINDOW_MS = 15 * 60 * 1000
const MAX_VERIFY_ATTEMPTS = 5
const VERIFICATION_TOKEN_TTL = '15m'

function getOtpSecret(): string {
  return (
    process.env.AUTH_OTP_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'connectafrik-otp-dev-secret'
  )
}

export function generateOtpCode(): string {
  const max = 10 ** OTP_LENGTH
  const num = crypto.randomInt(0, max)
  return num.toString().padStart(OTP_LENGTH, '0')
}

export function hashOtp(code: string, email: string): string {
  return crypto
    .createHmac('sha256', getOtpSecret())
    .update(`${email.toLowerCase()}:${code}`)
    .digest('hex')
}

export function createVerificationToken(payload: VerificationTokenPayload): string {
  return jwt.sign(payload, getOtpSecret(), { expiresIn: VERIFICATION_TOKEN_TTL })
}

export function verifyVerificationToken(token: string): VerificationTokenPayload {
  return jwt.verify(token, getOtpSecret()) as VerificationTokenPayload
}

type AuthUserRow = { id: string; email_confirmed_at: string | null }

export async function findAuthUserByEmail(
  serviceClient: SupabaseClient,
  email: string
): Promise<AuthUserRow | null> {
  const { data, error } = await serviceClient.rpc('auth_user_by_email', {
    check_email: email,
  })

  if (error) {
    throw new Error(error.message)
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.id) return null
  return row as AuthUserRow
}

export async function assertOtpSendAllowed(
  serviceClient: SupabaseClient,
  email: string,
  purpose: OtpPurpose
): Promise<{ error: string | null; cooldownSeconds?: number }> {
  const normalizedEmail = email.toLowerCase()
  const windowStart = new Date(Date.now() - SEND_WINDOW_MS).toISOString()

  const { data: recent, error } = await serviceClient
    .from('auth_email_otps')
    .select('id, created_at, resend_count')
    .eq('email', normalizedEmail)
    .eq('purpose', purpose)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    return { error: error.message }
  }

  if ((recent?.length ?? 0) >= MAX_SENDS_PER_WINDOW) {
    return { error: 'Too many OTP requests. Please try again later.' }
  }

  const latest = recent?.[0]
  if (latest?.created_at) {
    const elapsed = Date.now() - new Date(latest.created_at).getTime()
    if (elapsed < RESEND_COOLDOWN_MS) {
      const cooldownSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
      return {
        error: `Please wait ${cooldownSeconds}s before requesting another code.`,
        cooldownSeconds,
      }
    }
  }

  return { error: null }
}

export async function storeAndSendEmailOtp(params: {
  serviceClient: SupabaseClient
  email: string
  purpose: OtpPurpose
  metadata?: SignupProfileMetadata
  sendEmail: (email: string, code: string, purpose: OtpPurpose) => Promise<boolean>
}): Promise<{ error: string | null }> {
  const { serviceClient, email, purpose, metadata, sendEmail } = params
  const normalizedEmail = email.toLowerCase()
  const code = generateOtpCode()
  const otpHash = hashOtp(code, normalizedEmail)
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString()

  const { data: previous } = await serviceClient
    .from('auth_email_otps')
    .select('resend_count')
    .eq('email', normalizedEmail)
    .eq('purpose', purpose)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const resendCount = (previous?.resend_count ?? 0) + 1

  const { error: insertError } = await serviceClient.from('auth_email_otps').insert({
    email: normalizedEmail,
    otp_hash: otpHash,
    purpose,
    metadata: metadata ?? {},
    expires_at: expiresAt,
    resend_count: resendCount,
  })

  if (insertError) {
    return { error: insertError.message }
  }

  const emailSent = await sendEmail(normalizedEmail, code, purpose)
  if (!emailSent) {
    return { error: 'Failed to send verification email. Please try again.' }
  }

  return { error: null }
}

export async function verifyStoredEmailOtp(params: {
  serviceClient: SupabaseClient
  email: string
  code: string
  purpose: OtpPurpose
}): Promise<{ error: string | null; metadata?: SignupProfileMetadata }> {
  const { serviceClient, email, code, purpose } = params
  const normalizedEmail = email.toLowerCase()
  const now = new Date().toISOString()

  const { data: record, error } = await serviceClient
    .from('auth_email_otps')
    .select('id, otp_hash, metadata, attempts, expires_at, verified')
    .eq('email', normalizedEmail)
    .eq('purpose', purpose)
    .eq('verified', false)
    .gte('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { error: error.message }
  }

  if (!record) {
    return { error: 'Verification code has expired. Please request a new one.' }
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { error: 'Too many invalid attempts. Please request a new code.' }
  }

  const submittedHash = hashOtp(code, normalizedEmail)
  if (record.otp_hash.length !== submittedHash.length) {
    await serviceClient
      .from('auth_email_otps')
      .update({ attempts: record.attempts + 1 })
      .eq('id', record.id)
    return { error: 'Invalid verification code. Please try again.' }
  }

  const isValid = crypto.timingSafeEqual(
    Buffer.from(record.otp_hash),
    Buffer.from(submittedHash)
  )

  if (!isValid) {
    await serviceClient
      .from('auth_email_otps')
      .update({ attempts: record.attempts + 1 })
      .eq('id', record.id)

    return { error: 'Invalid verification code. Please try again.' }
  }

  await serviceClient
    .from('auth_email_otps')
    .update({ verified: true })
    .eq('id', record.id)

  const metadata = (record.metadata ?? {}) as SignupProfileMetadata
  return { error: null, metadata }
}

export function isSignupProfileMetadata(value: unknown): value is SignupProfileMetadata {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.username === 'string' &&
    typeof v.first_name === 'string' &&
    typeof v.last_name === 'string' &&
    typeof v.birthday === 'string' &&
    typeof v.gender === 'string'
  )
}
