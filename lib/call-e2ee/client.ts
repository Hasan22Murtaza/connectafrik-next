import { apiClient, ApiError } from '@/lib/api-client'
import { readCallE2eeKey } from '@/lib/call-media/e2ee-key'
import {
  loadOrCreateCallDevice,
  readLocalCallDevice,
  replaceRevokedCallDevice,
} from './device-store'
import { CALL_E2EE_JOIN_ERROR, base64ToBytes, bytesToBase64, isE2eeSessionRecord } from './protocol'
import { generateCallMediaKey, openCallMediaKey, sealCallMediaKey } from './seal'

export type SealedKeyPayload = {
  recipient_user_id: string
  recipient_device_id: string
  sealed_key: string
}

type RemoteDevice = {
  userId: string
  deviceId: string
  publicKey: string
}

async function registerStoredDevice(record: { deviceId: string; publicKey: string }): Promise<void> {
  await apiClient.post('/api/call-e2ee/devices', {
    device_id: record.deviceId,
    public_key: record.publicKey,
    platform: 'web',
  })
}

export async function ensureCallDeviceRegistered(): Promise<{ deviceId: string; publicKey: string; privateKey: string }> {
  let record = await loadOrCreateCallDevice()
  try {
    await registerStoredDevice(record)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (!/revoked/i.test(message)) throw error
    record = await replaceRevokedCallDevice()
    await registerStoredDevice(record)
  }
  return record
}

function sealForDevices(options: {
  callId: string
  senderDeviceId: string
  senderPrivateKey: Uint8Array
  mediaKey: Uint8Array
  devices: RemoteDevice[]
}): SealedKeyPayload[] {
  return options.devices.map((device) => {
    const recipientPublicKey = base64ToBytes(device.publicKey)
    if (!recipientPublicKey) throw new Error('A participant device key is invalid.')
    return {
      recipient_user_id: device.userId,
      recipient_device_id: device.deviceId,
      sealed_key: sealCallMediaKey({
        senderPrivateKey: options.senderPrivateKey,
        recipientPublicKey,
        mediaKey: options.mediaKey,
        callId: options.callId,
        senderDeviceId: options.senderDeviceId,
        recipientDeviceId: device.deviceId,
      }),
    }
  })
}

export async function prepareSealedCall(threadId: string, callId: string): Promise<{
  mediaKeyB64: string
  senderDeviceId: string
  sealedKeys: SealedKeyPayload[]
}> {
  const device = await ensureCallDeviceRegistered()
  const privateKey = base64ToBytes(device.privateKey)
  if (!privateKey) throw new Error('Could not read this device’s call key.')

  const listed = await apiClient.get<{ devices: RemoteDevice[]; missingUserIds: string[] }>(
    '/api/call-e2ee/devices',
    { thread_id: threadId },
  )
  if ((listed.missingUserIds || []).length > 0 || !listed.devices?.length) {
    throw new Error('Encrypted calling is not set up for every person in this chat yet.')
  }

  const mediaKey = generateCallMediaKey()
  return {
    mediaKeyB64: bytesToBase64(mediaKey),
    senderDeviceId: device.deviceId,
    sealedKeys: sealForDevices({
      callId,
      senderDeviceId: device.deviceId,
      senderPrivateKey: privateKey,
      mediaKey,
      devices: listed.devices,
    }),
  }
}

/** Keep the existing media key and seal it for someone invited mid-call. */
export async function sealExistingCallKeyForUser(options: {
  callId: string
  mediaKeyB64: string
  targetUserId: string
}): Promise<{ sender_device_id: string; sealed_keys: SealedKeyPayload[] }> {
  const device = await ensureCallDeviceRegistered()
  const privateKey = base64ToBytes(device.privateKey)
  const mediaKey = base64ToBytes(options.mediaKeyB64)
  if (!privateKey || !mediaKey || mediaKey.length !== 32) {
    throw new Error(CALL_E2EE_JOIN_ERROR)
  }

  const listed = await apiClient.get<{ devices: RemoteDevice[] }>('/api/call-e2ee/devices', {
    user_id: options.targetUserId,
  })
  if (!listed.devices?.length) {
    throw new Error('This person has not set up encrypted calling on a device yet.')
  }

  return {
    sender_device_id: device.deviceId,
    sealed_keys: sealForDevices({
      callId: options.callId,
      senderDeviceId: device.deviceId,
      senderPrivateKey: privateKey,
      mediaKey,
      devices: listed.devices,
    }),
  }
}

async function openOnce(callId: string): Promise<string> {
  const device = await readLocalCallDevice()
  if (!device) throw new ApiError(CALL_E2EE_JOIN_ERROR, 404)
  const row = await apiClient.get<{
    sealedKey: string
    senderDeviceId: string
    senderPublicKey: string
  }>('/api/call-e2ee/keys', {
    call_id: callId,
    device_id: device.deviceId,
  })
  const privateKey = base64ToBytes(device.privateKey)
  const senderPublicKey = base64ToBytes(row.senderPublicKey)
  if (!privateKey || !senderPublicKey) throw new Error(CALL_E2EE_JOIN_ERROR)
  try {
    const mediaKey = openCallMediaKey({
      recipientPrivateKey: privateKey,
      senderPublicKey,
      sealedKey: row.sealedKey,
      callId,
      senderDeviceId: row.senderDeviceId,
      recipientDeviceId: device.deviceId,
    })
    return bytesToBase64(mediaKey)
  } catch {
    throw new Error(CALL_E2EE_JOIN_ERROR)
  }
}

export async function openOwnSealedCallKey(callId: string): Promise<string> {
  let last: unknown
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await openOnce(callId)
    } catch (error) {
      last = error
      const missing = error instanceof ApiError && (error.status === 404 || error.status === 409)
      if (!missing || attempt === 3) break
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
    }
  }
  if (last instanceof Error && last.message === CALL_E2EE_JOIN_ERROR) throw last
  throw new Error(CALL_E2EE_JOIN_ERROR)
}

export async function resolveCallMediaKey(options: {
  hintedKey?: string
  sealedHint?: boolean
  threadId?: string
  callId?: string
}): Promise<{ mediaKey?: string; sealed: boolean }> {
  const hintedKey = options.hintedKey?.trim() || undefined
  const callId = options.callId?.trim() || ''
  const threadId = options.threadId?.trim() || ''

  if (!threadId || !callId) {
    return { mediaKey: hintedKey, sealed: Boolean(options.sealedHint && hintedKey) }
  }

  try {
    const res = await apiClient.get<{ session: { e2ee?: boolean; metadata?: unknown } | null }>(
      `/api/chat/threads/${threadId}/call-sessions`,
      { call_id: callId },
    )
    const required = isE2eeSessionRecord(res.session)
    if (required) {
      if (hintedKey && options.sealedHint) return { mediaKey: hintedKey, sealed: true }
      return { mediaKey: await openOwnSealedCallKey(callId), sealed: true }
    }
    return {
      mediaKey: hintedKey || readCallE2eeKey(res.session?.metadata),
      sealed: false,
    }
  } catch (error) {
    if (error instanceof Error && error.message === CALL_E2EE_JOIN_ERROR) throw error
    if (options.sealedHint && hintedKey) return { mediaKey: hintedKey, sealed: true }
    return { mediaKey: hintedKey, sealed: false }
  }
}

export async function callTokenDeviceFields(): Promise<{ device_id?: string }> {
  const device = await readLocalCallDevice()
  return device ? { device_id: device.deviceId } : {}
}
