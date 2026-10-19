'use client'

import { Buffer } from 'buffer'
import { SessionRecord } from 'libsignal'
import { base64ToBytes, bytesToBase64 } from '@/lib/message-e2ee/codec'

if (typeof globalThis.Buffer === 'undefined') {
  ;(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer
}

const DB_NAME = 'cribstalk-signal-e2ee'
const DB_VERSION = 1
const STORE = 'vaults'

export type KeyPairType = { pubKey: Buffer; privKey: Buffer }

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
  return {
    pubKey: bytesToBase64(pair.pubKey),
    privKey: bytesToBase64(pair.privKey),
  }
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

/**
 * libsignal storage backed by an AES-GCM sealed vault in IndexedDB.
 * Private key material never sits in localStorage or plain IndexedDB.
 */
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

  /** libsignal storage: local identity key pair */
  async getOurIdentity(): Promise<KeyPairType> {
    const pair = await this.getIdentityKeyPair()
    if (!pair) throw new Error('Missing identity key')
    return pair
  }

  /** libsignal storage: local registration id */
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

  listPreKeyPublics(): Array<{ keyId: number; publicKey: string }> {
    return Object.entries(this.data.preKeys).map(([keyId, pair]) => ({
      keyId: Number(keyId),
      publicKey: pair.pubKey,
    }))
  }
}
