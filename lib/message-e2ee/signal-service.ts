'use client'

import { Buffer } from 'buffer'
import {
  ProtocolAddress,
  SessionBuilder,
  SessionCipher,
  keyhelper as KeyHelper,
} from 'libsignal'
import { FingerprintGenerator } from 'libsignal/src/numeric_fingerprint'
import {
  base64ToBytes,
  bytesToBase64,
  decodeWireBody,
  encodeWireBody,
} from '@/lib/message-e2ee/codec'
import { SignalVaultStore, type KeyPairType } from '@/lib/message-e2ee/signal-store'
import type { DeviceKeyBundle, DeviceKeys, EncryptionService } from '@/lib/message-e2ee/types'

if (typeof globalThis.Buffer === 'undefined') {
  ;(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer
}

const OTK_BATCH = 100
const OTK_LOW = 20

type OutgoingBundle = {
  registrationId: number
  identityKey: Buffer
  signedPreKey: {
    keyId: number
    publicKey: Buffer
    signature: Buffer
  }
  preKey?: {
    keyId: number
    publicKey: Buffer
  }
}

/** ProtocolAddress forbids '.' in the name; keep user+device in the id. */
export function signalAddress(userId: string, deviceId: string): ProtocolAddress {
  return new ProtocolAddress(`${userId}:${deviceId}`, 1)
}

function detectPlatform(): { deviceName: string; platform: string } {
  if (typeof navigator === 'undefined') return { deviceName: 'Web', platform: 'web' }
  const ua = navigator.userAgent
  let browser = 'Browser'
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/Chrome\//.test(ua)) browser = 'Chrome'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari'
  let os = 'Web'
  if (/Windows/.test(ua)) os = 'Windows'
  else if (/Mac OS X/.test(ua)) os = 'macOS'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/iPhone|iPad/.test(ua)) os = 'iOS'
  else if (/Linux/.test(ua)) os = 'Linux'
  return { deviceName: `${browser} - ${os}`, platform: 'web' }
}

function toBuffer(value: string): Buffer {
  return Buffer.from(base64ToBytes(value))
}

function toOutgoingBundle(bundle: DeviceKeyBundle): OutgoingBundle {
  const device: OutgoingBundle = {
    identityKey: toBuffer(bundle.identityKey),
    registrationId: bundle.registrationId,
    signedPreKey: {
      keyId: bundle.signedPreKey.keyId,
      publicKey: toBuffer(bundle.signedPreKey.publicKey),
      signature: toBuffer(bundle.signedPreKey.signature),
    },
  }
  if (bundle.oneTimePreKey) {
    device.preKey = {
      keyId: bundle.oneTimePreKey.keyId,
      publicKey: toBuffer(bundle.oneTimePreKey.publicKey),
    }
  }
  return device
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

export class SignalEncryptionService implements EncryptionService {
  readonly store: SignalVaultStore
  private ready = false

  constructor(
    readonly userId: string,
    readonly deviceId: string,
    passphrase: string,
  ) {
    this.store = new SignalVaultStore(userId, deviceId, passphrase)
  }

  async initialize(): Promise<void> {
    if (this.ready) return
    await this.store.load()
    const identity = await this.store.getIdentityKeyPair()
    const registrationId = await this.store.getLocalRegistrationId()
    if (!identity || !registrationId) {
      const pair = KeyHelper.generateIdentityKeyPair() as KeyPairType
      const regId = KeyHelper.generateRegistrationId()
      await this.store.setIdentityKeyPair(pair)
      await this.store.setLocalRegistrationId(regId)
      const meta = detectPlatform()
      this.store.setDeviceMeta(meta.deviceName, meta.platform)
      await this.rotateSignedPreKey()
      await this.generateOneTimePreKeys(OTK_BATCH)
    } else if (!this.store.getCurrentSignedPreKey()) {
      await this.rotateSignedPreKey()
    }
    this.ready = true
    await this.store.flush()
  }

  private async rotateSignedPreKey() {
    const identity = await this.store.getIdentityKeyPair()
    if (!identity) throw new Error('Missing identity key')
    const keyId = this.store.allocateSignedPreKeyId()
    const signed = KeyHelper.generateSignedPreKey(identity, keyId) as {
      keyId: number
      keyPair: KeyPairType
      signature: Buffer
    }
    await this.store.storeSignedPreKeyWithSignature(keyId, signed.keyPair, signed.signature)
    return signed
  }

  private async generateOneTimePreKeys(count: number) {
    const ids = this.store.allocatePreKeyIds(count)
    const created: Array<{ keyId: number; publicKey: string }> = []
    for (const keyId of ids) {
      const preKey = KeyHelper.generatePreKey(keyId) as { keyId: number; keyPair: KeyPairType }
      await this.store.storePreKey(keyId, preKey.keyPair)
      created.push({ keyId, publicKey: bytesToBase64(preKey.keyPair.pubKey) })
    }
    return created
  }

  async generateDeviceKeys(): Promise<DeviceKeys> {
    const uploaded = await this.publicUploadBundle({ replenishOtks: true })
    return uploaded.keys
  }

  async publicUploadBundle(opts?: { replenishOtks?: boolean }): Promise<{
    keys: DeviceKeys
    deviceName: string
    platform: string
  }> {
    await this.initialize()
    const identity = await this.store.getIdentityKeyPair()
    const registrationId = await this.store.getLocalRegistrationId()
    if (!identity || registrationId == null) throw new Error('Device keys not ready')

    let signed = this.store.getCurrentSignedPreKey()
    if (!signed) {
      await this.rotateSignedPreKey()
      signed = this.store.getCurrentSignedPreKey()
    }
    if (!signed) throw new Error('Signed prekey missing')

    let oneTimePreKeys: Array<{ keyId: number; publicKey: string }> = []
    if (opts?.replenishOtks || this.store.countPreKeys() < OTK_LOW) {
      oneTimePreKeys = await this.generateOneTimePreKeys(OTK_BATCH)
    }

    await this.store.flush()
    const meta = this.store.getDeviceMeta()
    return {
      keys: {
        deviceId: this.deviceId,
        registrationId,
        identityPublicKey: bytesToBase64(identity.pubKey),
        signedPreKey: {
          keyId: signed.keyId,
          publicKey: signed.publicKey,
          signature: signed.signature,
        },
        oneTimePreKeys,
      },
      deviceName: meta.deviceName,
      platform: meta.platform,
    }
  }

  async createSession(recipientDevice: DeviceKeyBundle): Promise<void> {
    await this.initialize()
    this.store.noteRemoteIdentity(
      recipientDevice.userId,
      recipientDevice.deviceId,
      recipientDevice.identityKey,
    )
    const address = signalAddress(recipientDevice.userId, recipientDevice.deviceId)
    await this.store.saveIdentity(address.id, toBuffer(recipientDevice.identityKey))
    const builder = new SessionBuilder(this.store, address)
    await builder.initOutgoing(toOutgoingBundle(recipientDevice))
    await this.store.flush()
  }

  async hasSession(userId: string, deviceId: string): Promise<boolean> {
    await this.initialize()
    const record = await this.store.loadSession(signalAddress(userId, deviceId).toString())
    return Boolean(record?.haveOpenSession())
  }

  async encryptMessage(
    recipientDeviceId: string,
    recipientUserId: string,
    plaintext: string,
  ): Promise<{ type: number; body: string }> {
    await this.initialize()
    const address = signalAddress(recipientUserId, recipientDeviceId)
    const cipher = new SessionCipher(this.store, address)
    const encrypted = await cipher.encrypt(Buffer.from(new TextEncoder().encode(plaintext)))
    await this.store.flush()
    const body = encrypted.body
    if (body == null || (typeof body === 'string' ? body.length === 0 : body.length === 0)) {
      throw new Error('Encrypt produced empty body')
    }
    return { type: encrypted.type, body: encodeWireBody(body as string | Uint8Array) }
  }

  async decryptMessage(
    senderUserId: string,
    senderDeviceId: string,
    encrypted: { type: number; body: string },
  ): Promise<string> {
    await this.initialize()
    const address = signalAddress(senderUserId, senderDeviceId)
    const cipher = new SessionCipher(this.store, address)
    const wire = decodeWireBody(encrypted.body)
    const plain =
      encrypted.type === 3
        ? await cipher.decryptPreKeyWhisperMessage(wire)
        : await cipher.decryptWhisperMessage(wire)
    await this.store.flush()
    return new TextDecoder().decode(plain)
  }

  async safetyNumber(otherUserId: string, otherIdentityKeyB64: string): Promise<string> {
    await this.initialize()
    const identity = await this.store.getIdentityKeyPair()
    if (!identity) throw new Error('Missing identity key')
    const generator = new FingerprintGenerator(5200)
    return generator.createFor(
      this.userId,
      asArrayBuffer(identity.pubKey),
      otherUserId,
      asArrayBuffer(base64ToBytes(otherIdentityKeyB64)),
    )
  }

  async identityPublicKey(): Promise<string> {
    await this.initialize()
    const identity = await this.store.getIdentityKeyPair()
    if (!identity) throw new Error('Missing identity key')
    return bytesToBase64(identity.pubKey)
  }
}
