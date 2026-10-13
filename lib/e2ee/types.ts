export const E2EE_VERSION = 1
export const E2EE_PUSH_BODY = 'New message'
export const E2EE_THREAD_PREVIEW = 'New message'
export const PREKEY_BATCH = 100
export const PREKEY_REPLENISH_BELOW = 25
export const SIGNED_PREKEY_ROTATION_MS = 7 * 24 * 60 * 60 * 1000
export const DIRECTORY_CACHE_MS = 60_000

export type E2eeStatus = 'legacy' | 'decrypted' | 'failed'

export interface PublicPreKey {
  keyId: number
  publicKey: string
}

export interface PublicSignedPreKey extends PublicPreKey {
  signature: string
}

/** Public bundle. Private keys never appear here. */
export interface DeviceBundle {
  userId: string
  deviceId: number
  registrationId: number
  identityKey: string
  signedPreKey: PublicSignedPreKey
  preKey?: PublicPreKey
  deviceName?: string
  lastActiveAt?: string
}

export interface DeviceDirectoryEntry {
  userId: string
  deviceId: number
  registrationId: number
  identityKey: string
  signedPreKey: PublicSignedPreKey
  deviceName: string
  lastActiveAt: string
  createdAt: string
  prekeysRemaining?: number
}

export interface E2eeEnvelope {
  recipientUserId: string
  recipientDeviceId: number
  messageType: 1 | 3
  ciphertext: string
}

export interface PlaintextAttachment {
  name: string
  mime: string
  size: number
  url: string
  key: string
  iv: string
}

/** Serialized inside a Signal ciphertext. The server never sees this object. */
export interface PlaintextPayload {
  v: 1
  text: string
  attachments?: PlaintextAttachment[]
}

export interface UploadEncryptionMaterial {
  key: string
  iv: string
  originalName: string
  originalMime: string
  originalSize: number
  originalType: 'image' | 'video' | 'file'
}

export const UNDECRYPTABLE_TEXT = 'Unable to decrypt this message'
export const UNAVAILABLE_ON_DEVICE_TEXT = 'This message is not available on this device'
