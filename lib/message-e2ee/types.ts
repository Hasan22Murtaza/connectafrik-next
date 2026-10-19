/**
 * Crypto-provider-agnostic encryption surface.
 * Chat UI talks only to this contract (via engine.ts helpers).
 */

export type DeviceKeyBundle = {
  userId: string
  deviceId: string
  identityKey: string
  registrationId: number
  signedPreKey: {
    keyId: number
    publicKey: string
    signature: string
  }
  oneTimePreKey?: {
    keyId: number
    publicKey: string
  } | null
  deviceName?: string
  platform?: string
  verified?: boolean
  lastSeenAt?: string
}

export type DeviceKeys = {
  deviceId: string
  registrationId: number
  identityPublicKey: string
  signedPreKey: DeviceKeyBundle['signedPreKey']
  oneTimePreKeys: Array<{ keyId: number; publicKey: string }>
}

export type EncryptedEnvelope = {
  recipient_user_id: string
  recipient_device_id: string
  type: number
  body: string
}

export type EncryptedMessage = {
  version: 1
  protocol: 'signal'
  sender_device_id: string
  message_type: string
  envelopes: EncryptedEnvelope[]
  created_at: string
}

export interface EncryptionService {
  initialize(userId: string): Promise<void>
  generateDeviceKeys(): Promise<DeviceKeys>
  createSession(recipientDevice: DeviceKeyBundle): Promise<void>
  encryptMessage(recipientDeviceId: string, recipientUserId: string, plaintext: string): Promise<{
    type: number
    body: string
  }>
  decryptMessage(
    senderUserId: string,
    senderDeviceId: string,
    encrypted: { type: number; body: string },
  ): Promise<string>
}
