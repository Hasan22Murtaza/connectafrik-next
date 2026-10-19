import { Buffer } from 'buffer'
import type { EncryptedEnvelope, EncryptedMessage } from '@/lib/message-e2ee/types'

export const SIGNAL_E2EE_VERSION = 3
export const LEGACY_MEGOLM_VERSION = 2

export function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]!)
  return btoa(binary)
}

export function base64ToBytes(value: string): Uint8Array {
  const normalized = value.trim().replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  const binary = atob(normalized + pad)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}

export function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  const view = new Uint8Array(buffer)
  let out = ''
  for (let i = 0; i < view.length; i += 1) out += String.fromCharCode(view[i]!)
  return out
}

export function binaryStringToArrayBuffer(value: string): ArrayBuffer {
  const out = new Uint8Array(value.length)
  for (let i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i)
  return out.buffer
}

export function encodeWireBody(body: string | ArrayBuffer | Uint8Array): string {
  if (typeof body === 'string') {
    return bytesToBase64(binaryStringToArrayBuffer(body))
  }
  return bytesToBase64(body instanceof Uint8Array ? body : new Uint8Array(body))
}

/** Returns a Node/Buffer-compatible Uint8Array for libsignal decrypt. */
export function decodeWireBody(body: string): Buffer {
  return Buffer.from(base64ToBytes(body))
}

/** True when ciphertext is a raw Signal body (not a legacy JSON pack). */
export function isRawSignalBody(ciphertext: string): boolean {
  const trimmed = ciphertext.trim()
  return trimmed.length > 0 && !trimmed.startsWith('{')
}

/** Legacy pack format (pre body-only). Still decryptable for already-sent rows. */
export function parseEncryptedMessage(raw: string): EncryptedMessage | null {
  try {
    const parsed = JSON.parse(raw) as EncryptedMessage
    if (parsed?.protocol !== 'signal' || parsed.version !== 1) return null
    if (!Array.isArray(parsed.envelopes) || typeof parsed.sender_device_id !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export function pickEnvelopeForDevice(
  envelopes: EncryptedEnvelope[] | undefined,
  userId: string,
  deviceId: string,
): EncryptedEnvelope | null {
  if (!Array.isArray(envelopes)) return null
  return (
    envelopes.find(
      (item) => item.recipient_user_id === userId && item.recipient_device_id === deviceId,
    ) || null
  )
}
