import {
  Direction,
  type KeyPairType,
  type SessionRecordType,
  type StorageType,
} from '@privacyresearch/libsignal-protocol-typescript'
import { arrayBufferToBase64, base64ToArrayBuffer, copyBuffer, sameBytes } from './bytes'

export interface SerializedKeyPair {
  pubKey: string
  privKey: string
}

/** Snapshot of a Signal protocol store. This is private key material and must stay on-device or inside a passphrase-encrypted backup. */
export interface SerializedSignalStore {
  registrationId: number
  identityKeyPair: SerializedKeyPair
  preKeys: Record<string, SerializedKeyPair>
  signedPreKeys: Record<string, SerializedKeyPair>
  sessions: Record<string, string>
  identities: Record<string, string>
}

function pairToJson(pair: KeyPairType): SerializedKeyPair {
  return {
    pubKey: arrayBufferToBase64(pair.pubKey),
    privKey: arrayBufferToBase64(pair.privKey),
  }
}

function pairFromJson(pair: SerializedKeyPair): KeyPairType {
  return {
    pubKey: base64ToArrayBuffer(pair.pubKey),
    privKey: base64ToArrayBuffer(pair.privKey),
  }
}

function nameOf(identifier: string): string {
  const match = identifier.match(/^(.*)\.(\d+)$/)
  return match ? match[1] : identifier
}

/**
 * In-memory SignalProtocolStore. The IndexedDB vault persists a serialized copy;
 * tests use this class directly.
 */
export class MemorySignalStore implements StorageType {
  private registrationId: number | undefined
  private identityKeyPair: KeyPairType | undefined
  private readonly preKeys = new Map<string, KeyPairType>()
  private readonly signedPreKeys = new Map<string, KeyPairType>()
  private readonly sessions = new Map<string, string>()
  private readonly identities = new Map<string, ArrayBuffer>()

  async getIdentityKeyPair(): Promise<KeyPairType | undefined> {
    if (!this.identityKeyPair) return undefined
    return {
      pubKey: copyBuffer(this.identityKeyPair.pubKey),
      privKey: copyBuffer(this.identityKeyPair.privKey),
    }
  }

  async getLocalRegistrationId(): Promise<number | undefined> {
    return this.registrationId
  }

  async setLocalIdentity(identityKeyPair: KeyPairType, registrationId: number): Promise<void> {
    this.identityKeyPair = {
      pubKey: copyBuffer(identityKeyPair.pubKey),
      privKey: copyBuffer(identityKeyPair.privKey),
    }
    this.registrationId = registrationId
  }

  async isTrustedIdentity(
    identifier: string,
    identityKey: ArrayBuffer,
    _direction: Direction
  ): Promise<boolean> {
    const existing = this.identities.get(identifier) ?? this.identities.get(nameOf(identifier))
    if (!existing) return true
    return sameBytes(existing, identityKey)
  }

  async saveIdentity(encodedAddress: string, publicKey: ArrayBuffer): Promise<boolean> {
    const name = nameOf(encodedAddress)
    const previous = this.identities.get(name)
    const copy = copyBuffer(publicKey)
    this.identities.set(encodedAddress, copy)
    this.identities.set(name, copyBuffer(publicKey))
    return previous ? !sameBytes(previous, publicKey) : false
  }

  async loadPreKey(keyId: string | number): Promise<KeyPairType | undefined> {
    const found = this.preKeys.get(String(keyId))
    if (!found) return undefined
    return { pubKey: copyBuffer(found.pubKey), privKey: copyBuffer(found.privKey) }
  }

  async storePreKey(keyId: string | number, keyPair: KeyPairType): Promise<void> {
    this.preKeys.set(String(keyId), {
      pubKey: copyBuffer(keyPair.pubKey),
      privKey: copyBuffer(keyPair.privKey),
    })
  }

  async removePreKey(keyId: string | number): Promise<void> {
    this.preKeys.delete(String(keyId))
  }

  async loadSignedPreKey(keyId: string | number): Promise<KeyPairType | undefined> {
    const found = this.signedPreKeys.get(String(keyId))
    if (!found) return undefined
    return { pubKey: copyBuffer(found.pubKey), privKey: copyBuffer(found.privKey) }
  }

  async storeSignedPreKey(keyId: string | number, keyPair: KeyPairType): Promise<void> {
    this.signedPreKeys.set(String(keyId), {
      pubKey: copyBuffer(keyPair.pubKey),
      privKey: copyBuffer(keyPair.privKey),
    })
  }

  async removeSignedPreKey(keyId: string | number): Promise<void> {
    this.signedPreKeys.delete(String(keyId))
  }

  async loadSession(identifier: string): Promise<SessionRecordType | undefined> {
    return this.sessions.get(identifier)
  }

  async storeSession(identifier: string, record: SessionRecordType): Promise<void> {
    this.sessions.set(identifier, record)
  }

  async removeSession(identifier: string): Promise<void> {
    this.sessions.delete(identifier)
  }

  async removeAllSessions(name: string): Promise<void> {
    for (const key of [...this.sessions.keys()]) {
      if (key === name || key.startsWith(`${name}.`)) this.sessions.delete(key)
    }
  }

  export(): SerializedSignalStore {
    if (!this.identityKeyPair || this.registrationId == null) {
      throw new Error('Cannot export an uninitialized encryption store')
    }
    const preKeys: Record<string, SerializedKeyPair> = {}
    this.preKeys.forEach((pair, id) => {
      preKeys[id] = pairToJson(pair)
    })
    const signedPreKeys: Record<string, SerializedKeyPair> = {}
    this.signedPreKeys.forEach((pair, id) => {
      signedPreKeys[id] = pairToJson(pair)
    })
    const identities: Record<string, string> = {}
    this.identities.forEach((key, id) => {
      identities[id] = arrayBufferToBase64(key)
    })
    return {
      registrationId: this.registrationId,
      identityKeyPair: pairToJson(this.identityKeyPair),
      preKeys,
      signedPreKeys,
      sessions: Object.fromEntries(this.sessions.entries()),
      identities,
    }
  }

  static import(data: SerializedSignalStore): MemorySignalStore {
    const store = new MemorySignalStore()
    store.registrationId = data.registrationId
    store.identityKeyPair = pairFromJson(data.identityKeyPair)
    for (const [id, pair] of Object.entries(data.preKeys || {})) {
      store.preKeys.set(id, pairFromJson(pair))
    }
    for (const [id, pair] of Object.entries(data.signedPreKeys || {})) {
      store.signedPreKeys.set(id, pairFromJson(pair))
    }
    for (const [id, record] of Object.entries(data.sessions || {})) {
      store.sessions.set(id, record)
    }
    for (const [id, key] of Object.entries(data.identities || {})) {
      store.identities.set(id, base64ToArrayBuffer(key))
    }
    return store
  }
}
