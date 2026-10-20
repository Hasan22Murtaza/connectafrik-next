'use client'

/**
 * libsignal SessionCipher/SessionBuilder + sealed IndexedDB vault.
 * Key generation uses libsignal keyhelper / FingerprintGenerator.
 */

import { Buffer } from 'buffer'
import {
  ProtocolAddress,
  SessionBuilder,
  SessionCipher,
  SessionRecord,
  keyhelper as KeyHelper,
} from 'libsignal'
import { FingerprintGenerator } from 'libsignal/src/numeric_fingerprint'

if (typeof globalThis.Buffer === 'undefined') {
  ;(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer
}

export const SIGNAL_E2EE_VERSION = 3
export const LEGACY_MEGOLM_VERSION = 2

const OTK_BATCH = 100
const OTK_LOW = 20
const DB_NAME = 'cribstalk-signal-e2ee'
const DB_VERSION = 1
const STORE = 'vaults'

export type KeyPairType = { pubKey: Buffer; privKey: Buffer }

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

type EncryptedMessage = {
  version: 1
  protocol: 'signal'
  sender_device_id: string
  message_type: string
  envelopes: EncryptedEnvelope[]
  created_at: string
}

type StoredKeyPair = { pubKey: string; privKey: string }
type StoredSignedPreKey = StoredKeyPair & { signature: string }

type VaultData = {
  identityKeyPair?: StoredKeyPair
  registrationId?: number
  preKeys: Record<string, StoredKeyPair>
  signedPreKeys: Record<string, StoredSignedPreKey>
  currentSignedPreKeyId?: number
  sessions: Record<string, string>
  identities: Record<string, string>
  nextPreKeyId: number
  nextSignedPreKeyId: number
  ownsIdentity: boolean
  verifiedDevices: Record<string, boolean>
  knownIdentityKeys: Record<string, string>
  identityChangeFlags: Record<string, boolean>
  deviceName: string
  platform: string
}

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

function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  return Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString('base64')
}

function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value.trim().replace(/-/g, '+').replace(/_/g, '/'), 'base64'))
}

function encodeWireBody(body: string | ArrayBuffer | Uint8Array): string {
  if (typeof body === 'string') {
    return Buffer.from(body, 'binary').toString('base64')
  }
  return bytesToBase64(body instanceof Uint8Array ? body : new Uint8Array(body))
}

function decodeWireBody(body: string): Buffer {
  return Buffer.from(base64ToBytes(body))
}

export function isRawSignalBody(ciphertext: string): boolean {
  const trimmed = ciphertext.trim()
  return trimmed.length > 0 && !trimmed.startsWith('{')
}

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

function emptyVault(): VaultData {
  return {
    preKeys: {},
    signedPreKeys: {},
    sessions: {},
    identities: {},
    nextPreKeyId: 1,
    nextSignedPreKeyId: 1,
    ownsIdentity: false,
    verifiedDevices: {},
    knownIdentityKeys: {},
    identityChangeFlags: {},
    deviceName: 'Web',
    platform: 'web',
  }
}

function toStored(pair: KeyPairType): StoredKeyPair {
  return { pubKey: bytesToBase64(pair.pubKey), privKey: bytesToBase64(pair.privKey) }
}

function fromStored(pair: StoredKeyPair): KeyPairType {
  return {
    pubKey: Buffer.from(base64ToBytes(pair.pubKey)),
    privKey: Buffer.from(base64ToBytes(pair.privKey)),
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'))
  })
}

async function deriveKey(passphrase: string, salt: BufferSource): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 210_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function asBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

async function seal(passphrase: string, data: VaultData): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, asBufferSource(salt))
  const plaintext = new TextEncoder().encode(JSON.stringify(data))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asBufferSource(iv) }, key, plaintext),
  )
  return JSON.stringify({
    v: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ct: bytesToBase64(ciphertext),
  })
}

async function unseal(passphrase: string, sealed: string): Promise<VaultData> {
  const parsed = JSON.parse(sealed) as { salt?: string; iv?: string; ct?: string }
  if (!parsed.salt || !parsed.iv || !parsed.ct) throw new Error('Corrupt encryption vault')
  const salt = base64ToBytes(parsed.salt)
  const iv = base64ToBytes(parsed.iv)
  const ct = base64ToBytes(parsed.ct)
  const key = await deriveKey(passphrase, asBufferSource(salt))
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    key,
    asBufferSource(ct),
  )
  const data = JSON.parse(new TextDecoder().decode(plain)) as VaultData
  return {
    ...emptyVault(),
    ...data,
    preKeys: data.preKeys || {},
    signedPreKeys: data.signedPreKeys || {},
    sessions: data.sessions || {},
    identities: data.identities || {},
    verifiedDevices: data.verifiedDevices || {},
    knownIdentityKeys: data.knownIdentityKeys || {},
    identityChangeFlags: data.identityChangeFlags || {},
  }
}

function vaultKey(userId: string, deviceId: string) {
  return `${userId}:${deviceId}`
}

/** libsignal storage interface + AES-GCM sealed IndexedDB vault. */
export class SignalVaultStore {
  private data: VaultData = emptyVault()
  private dirty = false
  private persistChain: Promise<void> = Promise.resolve()

  constructor(
    private readonly userId: string,
    private readonly deviceId: string,
    private readonly passphrase: string,
  ) {}

  async load(): Promise<void> {
    const db = await openDatabase()
    try {
      const sealed = await new Promise<string | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const req = tx.objectStore(STORE).get(vaultKey(this.userId, this.deviceId))
        req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : undefined)
        req.onerror = () => reject(req.error || new Error('vault read failed'))
      })
      if (sealed) {
        this.data = await unseal(this.passphrase, sealed)
      } else {
        this.data = emptyVault()
        this.dirty = true
        await this.flush()
      }
    } finally {
      db.close()
    }
  }

  async flush(): Promise<void> {
    if (!this.dirty) return
    this.persistChain = this.persistChain.then(async () => {
      const sealed = await seal(this.passphrase, this.data)
      const db = await openDatabase()
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, 'readwrite')
          tx.objectStore(STORE).put(sealed, vaultKey(this.userId, this.deviceId))
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error || new Error('vault write failed'))
        })
        this.dirty = false
      } finally {
        db.close()
      }
    })
    await this.persistChain
  }

  private touch() {
    this.dirty = true
  }

  getOwnsIdentity(): boolean {
    return this.data.ownsIdentity
  }

  setOwnsIdentity(value: boolean) {
    this.data.ownsIdentity = value
    this.touch()
  }

  getDeviceMeta(): { deviceName: string; platform: string } {
    return { deviceName: this.data.deviceName || 'Web', platform: this.data.platform || 'web' }
  }

  setDeviceMeta(deviceName: string, platform: string) {
    this.data.deviceName = deviceName
    this.data.platform = platform
    this.touch()
  }

  isDeviceVerified(userId: string, deviceId: string): boolean {
    return this.data.verifiedDevices[`${userId}:${deviceId}`] === true
  }

  setDeviceVerified(userId: string, deviceId: string, verified: boolean) {
    this.data.verifiedDevices[`${userId}:${deviceId}`] = verified
    this.touch()
  }

  noteRemoteIdentity(userId: string, deviceId: string, identityKeyB64: string): 'ok' | 'changed' {
    const key = `${userId}:${deviceId}`
    const previous = this.data.knownIdentityKeys[key]
    if (previous && previous !== identityKeyB64) {
      this.data.identityChangeFlags[key] = true
      this.data.knownIdentityKeys[key] = identityKeyB64
      this.touch()
      return 'changed'
    }
    if (!previous) {
      this.data.knownIdentityKeys[key] = identityKeyB64
      this.touch()
    }
    return 'ok'
  }

  clearIdentityChange(userId: string, deviceId: string) {
    delete this.data.identityChangeFlags[`${userId}:${deviceId}`]
    this.touch()
  }

  hasIdentityChange(userId: string, deviceId: string): boolean {
    return this.data.identityChangeFlags[`${userId}:${deviceId}`] === true
  }

  allocatePreKeyIds(count: number): number[] {
    const ids: number[] = []
    for (let i = 0; i < count; i += 1) {
      ids.push(this.data.nextPreKeyId)
      this.data.nextPreKeyId += 1
    }
    this.touch()
    return ids
  }

  allocateSignedPreKeyId(): number {
    const id = this.data.nextSignedPreKeyId
    this.data.nextSignedPreKeyId += 1
    this.touch()
    return id
  }

  async getIdentityKeyPair(): Promise<KeyPairType | undefined> {
    return this.data.identityKeyPair ? fromStored(this.data.identityKeyPair) : undefined
  }

  async setIdentityKeyPair(pair: KeyPairType): Promise<void> {
    this.data.identityKeyPair = toStored(pair)
    this.touch()
  }

  async getLocalRegistrationId(): Promise<number | undefined> {
    return this.data.registrationId
  }

  async setLocalRegistrationId(id: number): Promise<void> {
    this.data.registrationId = id
    this.touch()
  }

  async getOurIdentity(): Promise<KeyPairType> {
    const pair = await this.getIdentityKeyPair()
    if (!pair) throw new Error('Missing identity key')
    return pair
  }

  async getOurRegistrationId(): Promise<number> {
    const id = await this.getLocalRegistrationId()
    if (id == null) throw new Error('Missing registration id')
    return id
  }

  async isTrustedIdentity(
    identifier: string,
    identityKey: Uint8Array | ArrayBuffer,
    _direction?: number,
  ): Promise<boolean> {
    const existing = this.data.identities[identifier]
    if (!existing) return true
    return existing === bytesToBase64(identityKey)
  }

  async saveIdentity(encodedAddress: string, publicKey: Uint8Array | ArrayBuffer): Promise<boolean> {
    const next = bytesToBase64(publicKey)
    const previous = this.data.identities[encodedAddress]
    this.data.identities[encodedAddress] = next
    this.touch()
    return Boolean(previous && previous !== next)
  }

  async loadPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
    const row = this.data.preKeys[String(keyId)]
    return row ? fromStored(row) : undefined
  }

  async storePreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    this.data.preKeys[String(keyId)] = toStored(keyPair)
    this.touch()
  }

  async removePreKey(keyId: number | string): Promise<void> {
    delete this.data.preKeys[String(keyId)]
    this.touch()
  }

  async storeSession(encodedAddress: string, record: SessionRecord): Promise<void> {
    this.data.sessions[encodedAddress] = JSON.stringify(record.serialize())
    this.touch()
  }

  async loadSession(encodedAddress: string): Promise<SessionRecord | undefined> {
    const raw = this.data.sessions[encodedAddress]
    if (!raw) return undefined
    return SessionRecord.deserialize(JSON.parse(raw))
  }

  async loadSignedPreKey(keyId?: number | string): Promise<KeyPairType | undefined> {
    const id = keyId != null ? String(keyId) : String(this.data.currentSignedPreKeyId || '')
    if (!id) return undefined
    const row = this.data.signedPreKeys[id]
    return row ? fromStored(row) : undefined
  }

  async storeSignedPreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    const existing = this.data.signedPreKeys[String(keyId)]
    this.data.signedPreKeys[String(keyId)] = {
      ...toStored(keyPair),
      signature: existing?.signature || '',
    }
    this.touch()
  }

  async storeSignedPreKeyWithSignature(
    keyId: number,
    keyPair: KeyPairType,
    signature: Uint8Array | ArrayBuffer,
  ): Promise<void> {
    this.data.signedPreKeys[String(keyId)] = {
      ...toStored(keyPair),
      signature: bytesToBase64(signature),
    }
    this.data.currentSignedPreKeyId = keyId
    this.touch()
  }

  getCurrentSignedPreKey(): { keyId: number; publicKey: string; signature: string } | null {
    const keyId = this.data.currentSignedPreKeyId
    if (!keyId) return null
    const row = this.data.signedPreKeys[String(keyId)]
    if (!row?.signature) return null
    return { keyId, publicKey: row.pubKey, signature: row.signature }
  }

  async removeSignedPreKey(keyId: number | string): Promise<void> {
    delete this.data.signedPreKeys[String(keyId)]
    this.touch()
  }

  countPreKeys(): number {
    return Object.keys(this.data.preKeys).length
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

export class SignalEncryptionService {
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

  /** libsignal FingerprintGenerator (5200 iterations). */
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
}
