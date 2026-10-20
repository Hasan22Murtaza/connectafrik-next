/**
 * Pure helpers for device-link sessions (no DB / secrets).
 * QR payload stays cribstalk-link:2:{userId}:{deviceId} — never private keys.
 */

export const LINK_SESSION_TTL_MS = 5 * 60 * 1000
export const MAX_PENDING_LINK_SESSIONS_PER_USER = 3
export const MAX_PENDING_LINK_SESSIONS_PER_DEVICE = 1

export type LinkSessionStatus =
  | 'pending'
  | 'scanned'
  | 'approved'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'revoked'

export const LINK_ERROR = {
  LINK_SESSION_NOT_FOUND: 'LINK_SESSION_NOT_FOUND',
  LINK_SESSION_EXPIRED: 'LINK_SESSION_EXPIRED',
  LINK_SESSION_ALREADY_USED: 'LINK_SESSION_ALREADY_USED',
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  DEVICE_ALREADY_REVOKED: 'DEVICE_ALREADY_REVOKED',
  DEVICE_NOT_AUTHORIZED: 'DEVICE_NOT_AUTHORIZED',
  DEVICE_PUBLIC_KEY_MISMATCH: 'DEVICE_PUBLIC_KEY_MISMATCH',
  USER_MISMATCH: 'USER_MISMATCH',
  INVALID_QR_PAYLOAD: 'INVALID_QR_PAYLOAD',
  INVALID_DEVICE_SIGNATURE: 'INVALID_DEVICE_SIGNATURE',
  LINK_APPROVAL_FAILED: 'LINK_APPROVAL_FAILED',
  LINK_COMPLETION_FAILED: 'LINK_COMPLETION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
} as const

export type LinkErrorCode = (typeof LINK_ERROR)[keyof typeof LINK_ERROR]

export class DeviceLinkError extends Error {
  readonly code: LinkErrorCode
  readonly httpStatus: number

  constructor(code: LinkErrorCode, message: string, httpStatus = 400) {
    super(message)
    this.name = 'DeviceLinkError'
    this.code = code
    this.httpStatus = httpStatus
  }
}

export function isDeviceId(value: string): boolean {
  return /^[A-Za-z0-9]{8,64}$/.test(value)
}

export function isIdentityPublicKey(value: string): boolean {
  return typeof value === 'string' && value.length >= 16 && value.length <= 512 && !/\s/.test(value)
}

export function resolveLinkSessionStatus(
  status: LinkSessionStatus,
  expiresAt: string | Date,
  nowMs = Date.now(),
): LinkSessionStatus {
  if (status === 'pending' || status === 'scanned' || status === 'approved') {
    const expires = typeof expiresAt === 'string' ? Date.parse(expiresAt) : expiresAt.getTime()
    if (Number.isFinite(expires) && expires <= nowMs) return 'expired'
  }
  return status
}

export function canApproveLinkStatus(status: LinkSessionStatus): boolean {
  return status === 'pending' || status === 'scanned'
}

export function canCompleteLinkStatus(status: LinkSessionStatus): boolean {
  return status === 'approved'
}

export function linkErrorFromRpcMessage(message: string): DeviceLinkError | null {
  const code = Object.values(LINK_ERROR).find((item) => message.includes(item))
  if (!code) return null
  const httpStatus =
    code === LINK_ERROR.LINK_SESSION_NOT_FOUND || code === LINK_ERROR.DEVICE_NOT_FOUND
      ? 404
      : code === LINK_ERROR.DEVICE_NOT_AUTHORIZED || code === LINK_ERROR.USER_MISMATCH
        ? 403
        : code === LINK_ERROR.RATE_LIMITED
          ? 429
          : 400
  return new DeviceLinkError(code, humanLinkError(code), httpStatus)
}

export function humanLinkError(code: LinkErrorCode): string {
  switch (code) {
    case LINK_ERROR.LINK_SESSION_NOT_FOUND:
      return 'That linking session was not found'
    case LINK_ERROR.LINK_SESSION_EXPIRED:
      return 'That linking code has expired. Generate a new QR on the other device.'
    case LINK_ERROR.LINK_SESSION_ALREADY_USED:
      return 'That linking code was already used'
    case LINK_ERROR.DEVICE_NOT_FOUND:
      return 'That device has not published encryption keys'
    case LINK_ERROR.DEVICE_ALREADY_REVOKED:
      return 'That device was already removed'
    case LINK_ERROR.DEVICE_NOT_AUTHORIZED:
      return 'This device is not allowed to approve linking'
    case LINK_ERROR.DEVICE_PUBLIC_KEY_MISMATCH:
      return 'The device public key does not match the registered keys'
    case LINK_ERROR.USER_MISMATCH:
      return 'This QR code is for a different account'
    case LINK_ERROR.INVALID_QR_PAYLOAD:
      return 'That is not a valid device linking code'
    case LINK_ERROR.INVALID_DEVICE_SIGNATURE:
      return 'Device approval signature was invalid'
    case LINK_ERROR.LINK_APPROVAL_FAILED:
      return 'Device approval failed'
    case LINK_ERROR.LINK_COMPLETION_FAILED:
      return 'Device linking could not be completed'
    case LINK_ERROR.RATE_LIMITED:
      return 'Too many linking attempts. Wait a moment and try again.'
    default:
      return 'Device linking failed'
  }
}

export function publicDeviceStatus(verified: boolean): 'trusted' | 'untrusted' {
  return verified ? 'trusted' : 'untrusted'
}
