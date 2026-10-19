import { xchacha20poly1305 } from '@noble/ciphers/chacha'
import { x25519 } from '@noble/curves/ed25519'
import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha2'
import {
  CALL_E2EE_NONCE_BYTES,
  CALL_E2EE_VERSION,
  CALL_MEDIA_KEY_BYTES,
  HKDF_INFO,
  HKDF_SALT,
  SEALED_CALL_KEY_BYTES,
  X25519_KEY_BYTES,
  base64ToBytes,
  bytesToBase64,
  callSealAad,
  randomBytes,
  utf8,
} from './protocol'

export type CallDeviceKeyPair = {
  publicKey: Uint8Array
  privateKey: Uint8Array
}

export function generateCallDeviceKeyPair(): CallDeviceKeyPair {
  const privateKey = x25519.utils.randomPrivateKey()
  const publicKey = x25519.getPublicKey(privateKey)
  return { publicKey, privateKey }
}

export function generateCallMediaKey(): Uint8Array {
  return randomBytes(CALL_MEDIA_KEY_BYTES)
}

function deriveWrappingKey(sharedSecret: Uint8Array): Uint8Array {
  return hkdf(sha256, sharedSecret, utf8(HKDF_SALT), utf8(HKDF_INFO), 32)
}

export function sealCallMediaKey(options: {
  senderPrivateKey: Uint8Array
  recipientPublicKey: Uint8Array
  mediaKey: Uint8Array
  callId: string
  senderDeviceId: string
  recipientDeviceId: string
  nonce?: Uint8Array
}): string {
  const {
    senderPrivateKey,
    recipientPublicKey,
    mediaKey,
    callId,
    senderDeviceId,
    recipientDeviceId,
  } = options
  if (senderPrivateKey.length !== X25519_KEY_BYTES) throw new Error('Invalid sender key')
  if (recipientPublicKey.length !== X25519_KEY_BYTES) throw new Error('Invalid recipient key')
  if (mediaKey.length !== CALL_MEDIA_KEY_BYTES) throw new Error('Invalid call media key')

  const nonce = options.nonce ?? randomBytes(CALL_E2EE_NONCE_BYTES)
  if (nonce.length !== CALL_E2EE_NONCE_BYTES) throw new Error('Invalid nonce')

  const shared = x25519.getSharedSecret(senderPrivateKey, recipientPublicKey)
  const wrappingKey = deriveWrappingKey(shared)
  const aad = callSealAad(callId, senderDeviceId, recipientDeviceId)
  const ciphertext = xchacha20poly1305(wrappingKey, nonce, aad).encrypt(mediaKey)

  const packed = new Uint8Array(1 + nonce.length + ciphertext.length)
  packed[0] = CALL_E2EE_VERSION
  packed.set(nonce, 1)
  packed.set(ciphertext, 1 + nonce.length)
  if (packed.length !== SEALED_CALL_KEY_BYTES) throw new Error('Unexpected seal length')
  return bytesToBase64(packed)
}

export function openCallMediaKey(options: {
  recipientPrivateKey: Uint8Array
  senderPublicKey: Uint8Array
  sealedKey: string
  callId: string
  senderDeviceId: string
  recipientDeviceId: string
}): Uint8Array {
  const packed = base64ToBytes(options.sealedKey)
  if (!packed || packed.length !== SEALED_CALL_KEY_BYTES || packed[0] !== CALL_E2EE_VERSION) {
    throw new Error('Invalid sealed call key')
  }
  if (options.recipientPrivateKey.length !== X25519_KEY_BYTES) throw new Error('Invalid recipient key')
  if (options.senderPublicKey.length !== X25519_KEY_BYTES) throw new Error('Invalid sender key')

  const nonce = packed.subarray(1, 1 + CALL_E2EE_NONCE_BYTES)
  const ciphertext = packed.subarray(1 + CALL_E2EE_NONCE_BYTES)
  const shared = x25519.getSharedSecret(options.recipientPrivateKey, options.senderPublicKey)
  const wrappingKey = deriveWrappingKey(shared)
  const aad = callSealAad(options.callId, options.senderDeviceId, options.recipientDeviceId)
  const mediaKey = xchacha20poly1305(wrappingKey, nonce, aad).decrypt(ciphertext)
  if (mediaKey.length !== CALL_MEDIA_KEY_BYTES) throw new Error('Invalid call media key')
  return mediaKey
}
