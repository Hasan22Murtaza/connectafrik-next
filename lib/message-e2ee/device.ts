'use client'

/**
 * Local device id / vault passphrase + link QR payloads.
 * Kept separate from signal.ts so Link-a-device UI can render before crypto loads.
 *
 * IMPORTANT: Avoid Array.from(..., (byte) => localConst[...]) — Turbopack's
 * production minify has dropped those closed-over locals ("alphabet is not defined").
 */

export function parseLinkPayload(payload: string): { userId: string; deviceId: string } | null {
  const trimmed = payload.trim().replace(/\s+/g, '')
  const v2 =
    /^cribstalk-link:2:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([A-Za-z0-9]{8,64})$/i.exec(
      trimmed,
    )
  if (v2) {
    return { userId: v2[1]!.toLowerCase(), deviceId: v2[2]! }
  }
  const v1 =
    /^cribstalk-link:1:@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):cribstalk:([A-Za-z0-9]{8,64})$/i.exec(
      trimmed,
    )
  if (v1) {
    return { userId: v1[1]!.toLowerCase(), deviceId: v1[2]! }
  }
  return null
}

export function normalizeLinkInput(
  raw: string,
  accountUserId: string,
): { userId: string; deviceId: string } | null {
  const trimmed = raw.trim()
  const parsed = parseLinkPayload(trimmed.replace(/\s+/g, ''))
  if (parsed) return parsed

  const deviceOnly =
    /^([A-Za-z0-9]{8,64})$/.exec(trimmed)?.[1] ||
    /^This\s*device:\s*([A-Za-z0-9]{8,64})$/i.exec(trimmed)?.[1]
  if (!deviceOnly) return null
  const userId = accountUserId.trim().toLowerCase()
  if (!userId) return null
  return { userId, deviceId: deviceOnly }
}

export function linkPayload(userId: string, deviceId: string): string {
  return `cribstalk-link:2:${userId.trim().toLowerCase()}:${deviceId}`
}

export function storageKey(userId: string, name: string) {
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
  const c = webCrypto()
  if (typeof c.randomUUID === 'function') {
    return c.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()
  }
  const bytes = c.getRandomValues(new Uint8Array(8))
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) {
    const value = bytes[i] ?? 0
    out += (value >>> 4).toString(16)
    out += (value & 0xf).toString(16)
  }
  return out.toUpperCase()
}

function randomPassphrase(): string {
  const bytes = webCrypto().getRandomValues(new Uint8Array(32))
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) {
    const value = bytes[i] ?? 0
    out += (value >>> 4).toString(16)
    out += (value & 0xf).toString(16)
  }
  return out
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
