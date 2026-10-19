/**
 * CribsTalk call-media key sealing.
 *
 * This is the CastLoom call envelope adapted to CribsTalk names:
 * one X25519 key pair per device, a fresh 32-byte media key per call,
 * and one XChaCha20-Poly1305 seal per recipient device.
 * The server stores the seal only. It never sees the media key.
 *
 * Wire format of `sealed_key` (standard base64):
 *   byte 0       version = 1
 *   bytes 1..24  random 24-byte XChaCha20 nonce
 *   bytes 25..   XChaCha20-Poly1305 ciphertext (32-byte key + 16-byte tag)
 *
 * Shared secret = X25519(sender private, recipient public).
 * Wrapping key  = HKDF-SHA256(
 *   ikm  = shared secret,
 *   salt = utf8 "cribstalk-call-e2ee-v1",
 *   info = utf8 "cribstalk.call.seal.v1",
 *   len  = 32,
 * ).
 * AAD = utf8 "cribstalk.call.v1\n{callId}\n{senderDeviceId}\n{recipientDeviceId}".
 *
 * Android, iOS, and web must produce this exact byte string.
 */

export const CALL_E2EE_VERSION = 1
export const CALL_E2EE_NONCE_BYTES = 24
export const CALL_MEDIA_KEY_BYTES = 32
export const X25519_KEY_BYTES = 32
export const SEALED_CALL_KEY_BYTES = 1 + CALL_E2EE_NONCE_BYTES + CALL_MEDIA_KEY_BYTES + 16

export const HKDF_SALT = 'cribstalk-call-e2ee-v1'
export const HKDF_INFO = 'cribstalk.call.seal.v1'

export const CALL_E2EE_JOIN_ERROR =
  'Unable to establish encrypted call.\nPlease leave and rejoin the call.'

const textEncoder = new TextEncoder()

export function utf8(value: string): Uint8Array {
  return textEncoder.encode(value)
}

export function callSealAad(callId: string, senderDeviceId: string, recipientDeviceId: string): Uint8Array {
  return utf8(
    `cribstalk.call.v1\n${callId.trim()}\n${senderDeviceId.trim().toLowerCase()}\n${recipientDeviceId.trim().toLowerCase()}`,
  )
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = ''
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  }
  return Buffer.from(bytes).toString('base64')
}

export function base64ToBytes(value: string): Uint8Array | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 512) return null
  try {
    if (typeof atob === 'function') {
      const binary = atob(trimmed)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
      return bytes
    }
    return new Uint8Array(Buffer.from(trimmed, 'base64'))
  } catch {
    return null
  }
}

export function canonicalBase64(value: string): string | null {
  const bytes = base64ToBytes(value)
  if (!bytes) return null
  return bytesToBase64(bytes)
}

export function isE2eeSessionRecord(
  row: { e2ee?: unknown; metadata?: unknown } | null | undefined,
): boolean {
  if (!row) return false
  if (row.e2ee === true) return true
  const metadata = row.metadata
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
  return (metadata as Record<string, unknown>).e2ee === true
}
