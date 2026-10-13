import {
  KeyHelper,
  SessionBuilder,
  SessionCipher,
  SignalProtocolAddress,
  type KeyPairType,
} from '@privacyresearch/libsignal-protocol-typescript'
import { arrayBufferToBase64, base64ToArrayBuffer, binaryStringToBase64 } from './bytes'
import { MemorySignalStore } from './memoryStore'
import { PREKEY_BATCH, type DeviceBundle, type E2eeEnvelope, type PublicPreKey, type PublicSignedPreKey } from './types'

export interface LocalAccount {
  registrationId: number
  identityKeyPair: KeyPairType
  signedPreKeyId: number
  signedPreKeyPublic: PublicSignedPreKey
  signedPreKeyCreatedAt: number
  preKeys: PublicPreKey[]
  nextPreKeyId: number
}

function addressFor(userId: string, deviceId: number): SignalProtocolAddress {
  // This library trusts an identity key per address name, not per device id.
  // Each CribsTalk device has its own identity key, so the name includes both.
  return new SignalProtocolAddress(`${userId}~${deviceId}`, 1)
}

function encodeBody(body: string | undefined): string {
  if (!body) throw new Error('Signal encrypt returned an empty body')
  return binaryStringToBase64(body)
}

export async function provisionAccount(store: MemorySignalStore, preKeyCount = PREKEY_BATCH): Promise<LocalAccount> {
  const identityKeyPair = await KeyHelper.generateIdentityKeyPair()
  const registrationId = KeyHelper.generateRegistrationId()
  const signed = await KeyHelper.generateSignedPreKey(identityKeyPair, 1)
  const preKeys: PublicPreKey[] = []
  for (let id = 1; id <= preKeyCount; id += 1) {
    const preKey = await KeyHelper.generatePreKey(id)
    await store.storePreKey(preKey.keyId, preKey.keyPair)
    preKeys.push({
      keyId: preKey.keyId,
      publicKey: arrayBufferToBase64(preKey.keyPair.pubKey),
    })
  }
  await store.setLocalIdentity(identityKeyPair, registrationId)
  await store.storeSignedPreKey(signed.keyId, signed.keyPair)
  return {
    registrationId,
    identityKeyPair,
    signedPreKeyId: signed.keyId,
    signedPreKeyPublic: {
      keyId: signed.keyId,
      publicKey: arrayBufferToBase64(signed.keyPair.pubKey),
      signature: arrayBufferToBase64(signed.signature),
    },
    signedPreKeyCreatedAt: Date.now(),
    preKeys,
    nextPreKeyId: preKeyCount + 1,
  }
}

export async function generatePreKeys(
  store: MemorySignalStore,
  startId: number,
  count: number
): Promise<PublicPreKey[]> {
  const preKeys: PublicPreKey[] = []
  for (let offset = 0; offset < count; offset += 1) {
    const id = startId + offset
    const preKey = await KeyHelper.generatePreKey(id)
    await store.storePreKey(preKey.keyId, preKey.keyPair)
    preKeys.push({
      keyId: preKey.keyId,
      publicKey: arrayBufferToBase64(preKey.keyPair.pubKey),
    })
  }
  return preKeys
}

export async function rotateSignedPreKey(
  store: MemorySignalStore,
  nextId: number
): Promise<PublicSignedPreKey> {
  const identity = await store.getIdentityKeyPair()
  if (!identity) throw new Error('No local identity key')
  const signed = await KeyHelper.generateSignedPreKey(identity, nextId)
  await store.storeSignedPreKey(signed.keyId, signed.keyPair)
  return {
    keyId: signed.keyId,
    publicKey: arrayBufferToBase64(signed.keyPair.pubKey),
    signature: arrayBufferToBase64(signed.signature),
  }
}

export async function hasSession(
  store: MemorySignalStore,
  userId: string,
  deviceId: number
): Promise<boolean> {
  const cipher = new SessionCipher(store, addressFor(userId, deviceId))
  return cipher.hasOpenSession()
}

/** X3DH session setup from a remote public bundle. One-time prekeys are optional. */
export async function establishSession(store: MemorySignalStore, bundle: DeviceBundle): Promise<void> {
  if (await hasSession(store, bundle.userId, bundle.deviceId)) return
  const builder = new SessionBuilder(store, addressFor(bundle.userId, bundle.deviceId))
  await builder.processPreKey({
    registrationId: bundle.registrationId,
    identityKey: base64ToArrayBuffer(bundle.identityKey),
    signedPreKey: {
      keyId: bundle.signedPreKey.keyId,
      publicKey: base64ToArrayBuffer(bundle.signedPreKey.publicKey),
      signature: base64ToArrayBuffer(bundle.signedPreKey.signature),
    },
    preKey: bundle.preKey
      ? {
          keyId: bundle.preKey.keyId,
          publicKey: base64ToArrayBuffer(bundle.preKey.publicKey),
        }
      : undefined,
  })
}

export async function encryptForDevice(
  store: MemorySignalStore,
  userId: string,
  deviceId: number,
  plaintext: string
): Promise<E2eeEnvelope> {
  const cipher = new SessionCipher(store, addressFor(userId, deviceId))
  const encoded = new TextEncoder().encode(plaintext)
  const result = await cipher.encrypt(encoded.buffer)
  const messageType = result.type === 3 ? 3 : 1
  return {
    recipientUserId: userId,
    recipientDeviceId: deviceId,
    messageType,
    ciphertext: encodeBody(result.body),
  }
}

export async function decryptFromDevice(
  store: MemorySignalStore,
  userId: string,
  deviceId: number,
  envelope: Pick<E2eeEnvelope, 'messageType' | 'ciphertext'>
): Promise<string> {
  const cipher = new SessionCipher(store, addressFor(userId, deviceId))
  const bytes = base64ToArrayBuffer(envelope.ciphertext)
  const plaintext =
    envelope.messageType === 3
      ? await cipher.decryptPreKeyWhisperMessage(bytes)
      : await cipher.decryptWhisperMessage(bytes)
  return new TextDecoder().decode(plaintext)
}

export async function localIdentityPublicKey(store: MemorySignalStore): Promise<ArrayBuffer | null> {
  const pair = await store.getIdentityKeyPair()
  return pair ? copyPublic(pair.pubKey) : null
}

function copyPublic(buffer: ArrayBuffer): ArrayBuffer {
  return buffer.slice(0)
}
