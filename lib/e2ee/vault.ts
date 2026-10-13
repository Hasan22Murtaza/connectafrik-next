import { arrayBufferToBase64, base64ToArrayBuffer, bytesToBase64 } from './bytes'
import { MemorySignalStore, type SerializedSignalStore } from './memoryStore'
import type { PlaintextPayload } from './types'

const DB_NAME = 'cribstalk-e2ee'
const DB_VERSION = 1

export interface VaultMeta {
  userId: string
  deviceId: number
  deviceName: string
  registrationId: number
  signedPreKeyId: number
  signedPreKeyPublic: string
  signedPreKeySignature: string
  signedPreKeyCreatedAt: number
  nextPreKeyId: number
}

interface VaultBlob {
  meta: VaultMeta
  store: SerializedSignalStore
}

/**
 * Private keys are encrypted with a non-extractable AES-GCM key that lives in
 * IndexedDB. They are never written to localStorage or Supabase.
 */
export class E2eeVault {
  private db: IDBDatabase | null = null
  private wrapKey: CryptoKey | null = null
  private store: MemorySignalStore | null = null
  private meta: VaultMeta | null = null
  private persistChain: Promise<void> = Promise.resolve()

  getSignalStore(): MemorySignalStore {
    if (!this.store) throw new Error('Encryption storage is not open')
    return this.store
  }

  getMeta(): VaultMeta | null {
    return this.meta ? { ...this.meta } : null
  }

  setMeta(meta: VaultMeta): void {
    this.meta = { ...meta }
    this.queuePersist()
  }

  queuePersist(): void {
    this.persistChain = this.persistChain.then(() => this.persist()).catch(() => undefined)
  }

  async flush(): Promise<void> {
    this.queuePersist()
    await this.persistChain
  }

  async openForUser(userId: string): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      throw new Error('This browser cannot store encryption keys')
    }
    await this.openDb()
    await this.loadWrapKey()
    await this.loadVault()
    if (this.meta && this.meta.userId !== userId) {
      await this.wipe()
      await this.openDb()
      await this.loadWrapKey()
      this.store = new MemorySignalStore()
      this.meta = null
    }
    if (!this.store) this.store = new MemorySignalStore()
  }

  async cachePlaintext(
    id: string,
    threadId: string,
    payload: PlaintextPayload,
    fingerprint?: string
  ): Promise<void> {
    if (!this.db || !this.wrapKey) return
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const data = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.wrapKey,
      new TextEncoder().encode(JSON.stringify({ threadId, payload, fingerprint }))
    )
    await idbPut(this.db, 'cache', { id, iv: bytesToBase64(iv), data })
  }

  async readPlaintext(
    id: string
  ): Promise<{ threadId: string; payload: PlaintextPayload; fingerprint?: string } | null> {
    if (!this.db || !this.wrapKey) return null
    const row = await idbGet<{ id: string; iv: string; data: ArrayBuffer }>(this.db, 'cache', id)
    if (!row) return null
    try {
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(base64ToArrayBuffer(row.iv)) },
        this.wrapKey,
        row.data
      )
      return JSON.parse(new TextDecoder().decode(plain)) as {
        threadId: string
        payload: PlaintextPayload
        fingerprint?: string
      }
    } catch {
      return null
    }
  }

  async searchPlaintext(threadId: string, keyword: string): Promise<Array<{ id: string; payload: PlaintextPayload }>> {
    if (!this.db || !this.wrapKey) return []
    const rows = await idbAll<{ id: string; iv: string; data: ArrayBuffer }>(this.db, 'cache')
    const needle = keyword.toLowerCase()
    const hits: Array<{ id: string; payload: PlaintextPayload }> = []
    for (const row of rows) {
      const decoded = await this.readPlaintext(row.id)
      if (!decoded || decoded.threadId !== threadId) continue
      const text = decoded.payload.text || ''
      const names = (decoded.payload.attachments || []).map((item) => item.name).join(' ')
      if (`${text} ${names}`.toLowerCase().includes(needle)) {
        hits.push({ id: row.id, payload: decoded.payload })
      }
    }
    return hits
  }

  exportPrivateState(): { meta: VaultMeta; store: SerializedSignalStore } {
    if (!this.meta || !this.store) throw new Error('Nothing to back up')
    return { meta: this.meta, store: this.store.export() }
  }

  async importPrivateState(state: { meta: VaultMeta; store: SerializedSignalStore }): Promise<void> {
    this.meta = state.meta
    this.store = MemorySignalStore.import(state.store)
    await this.persist()
  }

  async wipe(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    this.wrapKey = null
    this.store = null
    this.meta = null
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => resolve()
    })
  }

  private async openDb(): Promise<void> {
    if (this.db) return
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys')
        if (!db.objectStoreNames.contains('vault')) db.createObjectStore('vault')
        if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'id' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  private async loadWrapKey(): Promise<void> {
    if (!this.db) return
    const existing = await idbGet<CryptoKey>(this.db, 'keys', 'wrap')
    if (existing) {
      this.wrapKey = existing
      return
    }
    this.wrapKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    await idbPut(this.db, 'keys', this.wrapKey, 'wrap')
  }

  private async loadVault(): Promise<void> {
    if (!this.db || !this.wrapKey) return
    const row = await idbGet<{ iv: string; data: ArrayBuffer }>(this.db, 'vault', 'state')
    if (!row) {
      this.store = new MemorySignalStore()
      return
    }
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(base64ToArrayBuffer(row.iv)) },
      this.wrapKey,
      row.data
    )
    const parsed = JSON.parse(new TextDecoder().decode(plain)) as VaultBlob
    this.meta = parsed.meta
    this.store = MemorySignalStore.import(parsed.store)
  }

  private async persist(): Promise<void> {
    if (!this.db || !this.wrapKey || !this.store || !this.meta) return
    let exported: SerializedSignalStore
    try {
      exported = this.store.export()
    } catch {
      return
    }
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const data = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.wrapKey,
      new TextEncoder().encode(JSON.stringify({ meta: this.meta, store: exported } satisfies VaultBlob))
    )
    await idbPut(this.db, 'vault', { iv: bytesToBase64(iv), data }, 'state')
  }
}

function idbPut(db: IDBDatabase, store: string, value: unknown, key?: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const request = key === undefined ? tx.objectStore(store).put(value) : tx.objectStore(store).put(value, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

function idbGet<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const request = tx.objectStore(store).get(key)
    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () => reject(request.error)
  })
}

function idbAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const request = tx.objectStore(store).getAll()
    request.onsuccess = () => resolve((request.result || []) as T[])
    request.onerror = () => reject(request.error)
  })
}

export function publicIdentityFromStore(store: MemorySignalStore): Promise<string | null> {
  return store.getIdentityKeyPair().then((pair) => (pair ? arrayBufferToBase64(pair.pubKey) : null))
}
