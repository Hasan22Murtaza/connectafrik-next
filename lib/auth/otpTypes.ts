export const OTP_PURPOSES = ['signup', 'login', 'recovery'] as const

export type OtpPurpose = (typeof OTP_PURPOSES)[number]

export function isOtpPurpose(value: unknown): value is OtpPurpose {
  return typeof value === 'string' && (OTP_PURPOSES as readonly string[]).includes(value)
}

export type SignupProfileMetadata = {
  username: string
  first_name: string
  last_name: string
  birthday: string
  gender: string
  address?: string | null
  city?: string | null
  state?: string | null
  zipcode?: string | null
  country?: string | null
  phone_number?: string | null
  is_phone_registration?: boolean
}

export type VerificationTokenPayload = {
  email: string
  purpose: OtpPurpose
  metadata?: SignupProfileMetadata
}
