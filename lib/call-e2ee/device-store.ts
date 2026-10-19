import { generateCallDeviceKeyPair } from './seal'
import { bytesToBase64, base64ToBytes } from './protocol'

const DB_NAME = 'cribstalk-call-e2ee'
const STORE = 'device'
const RECORD_KEY = 'current'

type StoredCallDevice = {
  deviceId: string
  publicKey: string
  privateKey: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open call device storage'))
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Call device storage failed'))
  })
}

async function readRecord(): Promise<StoredCallDevice | null> {
  if (typeof indexedDB === 'undefined') return null
  const db = await openDb()
  try {
    const record = await requestToPromise(
      db.transaction(STORE, 'readonly').objectStore(STORE).get(RECORD_KEY),
    )
    if (!record || typeof record !== 'object') return null
    const stored = record as StoredCallDevice
    if (!stored.deviceId || !stored.publicKey || !stored.privateKey) return null
    return stored
  } finally {
    db.close()
  }
}

async function writeRecord(record: StoredCallDevice): Promise<void> {
  const db = await openDb()
  try {
    await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(record, RECORD_KEY))
  } finally {
    db.close()
  }
}

export async function readLocalCallDevice(): Promise<StoredCallDevice | null> {
  return readRecord()
}

export async function readLocalCallDeviceId(): Promise<string | undefined> {
  const record = await readRecord()
  return record?.deviceId
}

export async function loadOrCreateCallDevice(): Promise<StoredCallDevice> {
  const existing = await readRecord()
  if (existing) {
    const secret = base64ToBytes(existing.privateKey)
    const pub = base64ToBytes(existing.publicKey)
    if (secret?.length === 32 && pub?.length === 32) return existing
  }

  const generated = generateCallDeviceKeyPair()
  const record: StoredCallDevice = {
    deviceId: crypto.randomUUID(),
    publicKey: bytesToBase64(generated.publicKey),
    privateKey: bytesToBase64(generated.privateKey),
  }
  await writeRecord(record)
  return record
}

/** Drop the local key after the server says this device id was revoked. */
export async function replaceRevokedCallDevice(): Promise<StoredCallDevice> {
  const generated = generateCallDeviceKeyPair()
  const record: StoredCallDevice = {
    deviceId: crypto.randomUUID(),
    publicKey: bytesToBase64(generated.publicKey),
    privateKey: bytesToBase64(generated.privateKey),
  }
  await writeRecord(record)
  return record
}
