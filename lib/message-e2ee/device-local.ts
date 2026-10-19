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

function randomDeviceId(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

function randomPassphrase(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function deviceCredentials(userId: string): { deviceId: string; passphrase: string } {
  if (typeof window === 'undefined') {
    throw new Error('Device linking requires a browser')
  }
  const deviceKey = storageKey(userId, 'device-id')
  const passKey = storageKey(userId, 'store-passphrase')
  let deviceId = localStorage.getItem(deviceKey) || ''
  let passphrase = localStorage.getItem(passKey) || ''
  if (!/^[A-Za-z0-9]{8,64}$/.test(deviceId)) {
    deviceId = randomDeviceId()
    localStorage.setItem(deviceKey, deviceId)
  }
  if (passphrase.length < 32) {
    passphrase = randomPassphrase()
    localStorage.setItem(passKey, passphrase)
  }
  return { deviceId, passphrase }
}

export function readOwnsIdentityFlag(userId: string): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(storageKey(userId, 'owns-identity')) === 'yes'
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
