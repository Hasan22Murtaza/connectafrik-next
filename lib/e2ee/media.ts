import { base64ToArrayBuffer, bytesToBase64 } from './bytes'

const FILE_ALGO = 'AES-GCM'
const BACKUP_ALGO = 'AES-GCM'
const PBKDF2_ITERATIONS = 600_000

export interface EncryptedFile {
  ciphertext: Uint8Array
  key: string
  iv: string
}

/**
 * Attachment encryption uses Web Crypto AES-256-GCM.
 * The random file key is carried only inside the Signal-encrypted message.
 */
export async function encryptFileBytes(plain: Uint8Array): Promise<EncryptedFile> {
  const key = await crypto.subtle.generateKey({ name: FILE_ALGO, length: 256 }, true, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: FILE_ALGO, iv }, key, copyBytes(plain))
  )
  return {
    ciphertext,
    key: bytesToBase64(rawKey),
    iv: bytesToBase64(iv),
  }
}

export async function decryptFileBytes(ciphertext: Uint8Array, keyB64: string, ivB64: string): Promise<Uint8Array> {
  const rawKey = base64ToArrayBuffer(keyB64)
  const iv = new Uint8Array(base64ToArrayBuffer(ivB64))
  const key = await crypto.subtle.importKey('raw', rawKey, { name: FILE_ALGO }, false, ['decrypt'])
  const plain = await crypto.subtle.decrypt({ name: FILE_ALGO, iv }, key, copyBytes(ciphertext))
  return new Uint8Array(plain)
}

export const BACKUP_KDF = `PBKDF2-SHA-256-${PBKDF2_ITERATIONS}`

export interface EncryptedBackup {
  ciphertext: string
  salt: string
  iv: string
  kdf: string
}

/**
 * Optional user-controlled key backup.
 * The server stores only this ciphertext. A weak passphrase can be guessed by
 * anyone who obtains the backup, including the server operator.
 */
export async function encryptBackup(json: string, passphrase: string): Promise<EncryptedBackup> {
  if (passphrase.trim().length < 8) {
    throw new Error('Use a recovery passphrase of at least 8 characters')
  }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveBackupKey(passphrase, salt)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: BACKUP_ALGO, iv }, key, new TextEncoder().encode(json))
  )
  return {
    ciphertext: bytesToBase64(ciphertext),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    kdf: BACKUP_KDF,
  }
}

export async function decryptBackup(backup: EncryptedBackup, passphrase: string): Promise<string> {
  if (backup.kdf !== BACKUP_KDF) {
    throw new Error('Unsupported key backup format')
  }
  const salt = new Uint8Array(base64ToArrayBuffer(backup.salt))
  const iv = new Uint8Array(base64ToArrayBuffer(backup.iv))
  const key = await deriveBackupKey(passphrase, salt)
  const plain = await crypto.subtle.decrypt(
    { name: BACKUP_ALGO, iv },
    key,
    base64ToArrayBuffer(backup.ciphertext)
  )
  return new TextDecoder().decode(plain)
}

async function deriveBackupKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: copyBytes(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: BACKUP_ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function copyBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}
