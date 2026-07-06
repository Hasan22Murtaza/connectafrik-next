export type PasswordRequirement = {
  id: string
  label: string
  met: boolean
}

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong'

const SPECIAL_CHAR_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    { id: 'length', label: 'At least 8 characters', met: password.length >= 8 },
    { id: 'upper', label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { id: 'lower', label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { id: 'number', label: 'One number', met: /\d/.test(password) },
    {
      id: 'special',
      label: 'One special character',
      met: SPECIAL_CHAR_RE.test(password),
    },
  ]
}

export function isPasswordValid(password: string): boolean {
  return getPasswordRequirements(password).every((req) => req.met)
}

export function getPasswordStrength(password: string): PasswordStrength {
  const requirements = getPasswordRequirements(password)
  const metCount = requirements.filter((req) => req.met).length

  if (!password) return 'weak'
  if (metCount <= 2) return 'weak'
  if (metCount === 3) return 'fair'
  if (metCount === 4) return 'good'
  return 'strong'
}

export function validatePasswordPair(
  password: string,
  confirmPassword: string
): string | null {
  if (!isPasswordValid(password)) {
    return 'Password does not meet all requirements'
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match'
  }
  return null
}
