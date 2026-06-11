export type AuthHashResult =
  | { kind: 'error'; errorCode: string | null; description: string | null }
  | { kind: 'signup'; accessToken: string; refreshToken: string | null }
  | { kind: 'none' }

export function parseAuthHash(hash: string): AuthHashResult {
  const raw = hash.replace(/^#/, '').trim()
  if (!raw) return { kind: 'none' }

  const params = new URLSearchParams(raw)
  const error = params.get('error')
  const errorCode = params.get('error_code')

  if (error || errorCode) {
    return {
      kind: 'error',
      errorCode,
      description: params.get('error_description'),
    }
  }

  const accessToken = params.get('access_token')
  const type = params.get('type')
  if (accessToken && type === 'signup') {
    return {
      kind: 'signup',
      accessToken,
      refreshToken: params.get('refresh_token'),
    }
  }

  return { kind: 'none' }
}

export function authLinkErrorQuery(errorCode: string | null): string {
  if (errorCode === 'otp_expired') return 'link_expired'
  return 'auth'
}
