'use client'

import { linkPayload } from '@/lib/message-e2ee/ids'

/**
 * Local-only device id / vault passphrase metadata.
 * Used to render the Link a device QR immediately while Signal keys bootstrap.
 * The passphrase unlocks the AES-GCM sealed IndexedDB vault — private keys are
 * not stored in localStorage.
 */

function storageKey(userId: string, name: string) {
  return `cribstalk.message-e2ee.${userId}.${name}`
}

function webCrypto(): Crypto {
  const c = globalThis.crypto
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error(
      'This browser cannot create a device id (Web Crypto unavailable). Use a current browser over HTTPS.',
    )
  }
  return c
}

function randomDeviceId(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = webCrypto().getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

function randomPassphrase(): string {
  const bytes = webCrypto().getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function readStorage(key: string): string {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    throw new Error(
      'This browser blocked local storage, so a device id could not be saved. Allow site data for CribsTalk and try again.',
    )
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    throw new Error(
      'This browser blocked local storage, so a device id could not be saved. Allow site data for CribsTalk and try again.',
    )
  }
}

export function deviceCredentials(userId: string): { deviceId: string; passphrase: string } {
  if (typeof window === 'undefined') {
    throw new Error('Device linking requires a browser')
  }
  const deviceKey = storageKey(userId, 'device-id')
  const passKey = storageKey(userId, 'store-passphrase')
  let deviceId = readStorage(deviceKey)
  let passphrase = readStorage(passKey)
  if (!/^[A-Za-z0-9]{8,64}$/.test(deviceId)) {
    deviceId = randomDeviceId()
    writeStorage(deviceKey, deviceId)
  }
  if (passphrase.length < 32) {
    passphrase = randomPassphrase()
    writeStorage(passKey, passphrase)
  }
  return { deviceId, passphrase }
}

export function readOwnsIdentityFlag(userId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(storageKey(userId, 'owns-identity')) === 'yes'
  } catch {
    return false
  }
}

export function localLinkDeviceInfo(userId: string): {
  deviceId: string
  ownsIdentity: boolean
  payload: string
} {
  const { deviceId } = deviceCredentials(userId)
  return {
    deviceId,
    ownsIdentity: readOwnsIdentityFlag(userId),
    payload: linkPayload(userId, deviceId),
  }
}

export { storageKey }
