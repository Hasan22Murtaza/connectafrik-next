'use client'

import { apiClient } from '@/lib/api-client'
import type { ChatAttachment, ChatMessage } from '@/features/chat/services/supabaseMessagingService'
import { openAttachment as decryptSealedBytes } from '@/lib/message-e2ee/attachment-seal'
import {
  deviceCredentials,
  localLinkDeviceInfo as readLocalLinkDeviceInfo,
  linkPayload,
  normalizeLinkInput,
  storageKey,
} from '@/lib/message-e2ee/device'
import {
  isRawSignalBody,
  LEGACY_MEGOLM_VERSION,
  parseEncryptedMessage,
  pickEnvelopeForDevice,
  SIGNAL_E2EE_VERSION,
  SignalEncryptionService,
  type DeviceKeyBundle,
  type EncryptedEnvelope,
} from '@/lib/message-e2ee/signal'
import { messageE2eeActive } from '@/lib/message-e2ee/status'

export { localLinkDeviceInfo } from '@/lib/message-e2ee/device'
export { SIGNAL_E2EE_VERSION }

const LOCKED = "🔒 This message can't be read on this device"
const LINK_SESSION_KEY = 'link-session-id'

export type EncryptResult =
  | { mode: 'off' }
  | { mode: 'fallback'; reason: string }
  | {
      mode: 'signal'
      /** Raw Signal body only — never a JSON pack. */
      ciphertext: string
      senderDeviceId: string
      e2eeVersion: typeof SIGNAL_E2EE_VERSION
      envelopes: EncryptedEnvelope[]
    }

type LinkSessionCreateResult = {
  sessionId: string
  deviceId: string
  expiresAt: string
  status: string
  qrPayload: string
}

let service: SignalEncryptionService | null = null
let activeUserId: string | null = null
let queue: Promise<unknown> = Promise.resolve()
let pollTimer: number | null = null
const keyListeners = new Set<() => void>()
const decryptCache = new Map<string, ChatMessage>()

function readLinkSessionId(userId: string): string {
  try {
    return localStorage.getItem(storageKey(userId, LINK_SESSION_KEY)) || ''
  } catch {
    return ''
  }
}

function writeLinkSessionId(userId: string, sessionId: string) {
  try {
    if (sessionId) localStorage.setItem(storageKey(userId, LINK_SESSION_KEY), sessionId)
    else localStorage.removeItem(storageKey(userId, LINK_SESSION_KEY))
  } catch {
    // ignore storage failures — session id is best-effort cache
  }
}

async function ensureLinkSession(
  current: SignalEncryptionService,
  publicKey?: string,
  forceNew = false,
): Promise<LinkSessionCreateResult | null> {
  if (current.store.getOwnsIdentity()) return null
  try {
    if (!forceNew) {
      const existingId = readLinkSessionId(current.userId)
      if (existingId) {
        const status = await apiClient
          .get<{ status?: string; expiresAt?: string; sessionId?: string; deviceId?: string }>(
            `/api/message-e2ee/devices/link/session/${encodeURIComponent(existingId)}`,
          )
          .catch(() => null)
        if (status?.status === 'pending' || status?.status === 'scanned' || status?.status === 'approved') {
          return {
            sessionId: status.sessionId || existingId,
            deviceId: status.deviceId || current.deviceId,
            expiresAt: status.expiresAt || '',
            status: status.status,
            qrPayload: linkPayload(current.userId, current.deviceId),
          }
        }
      }
    }
    let identityKey = publicKey || ''
    if (!identityKey) {
      const uploaded = await current.publicUploadBundle({ replenishOtks: false })
      identityKey = uploaded.keys.identityPublicKey
    }
    const meta = current.store.getDeviceMeta()
    const created = await apiClient.post<LinkSessionCreateResult>('/api/message-e2ee/devices/link/session', {
      deviceId: current.deviceId,
      deviceType: 'browser',
      platform: meta.platform || 'web',
      deviceName: meta.deviceName || 'Web',
      publicKey: identityKey,
    })
    if (created?.sessionId) writeLinkSessionId(current.userId, created.sessionId)
    return created
  } catch {
    return null
  }
}

async function completeOpenLinkSession(userId: string, deviceId: string) {
  const sessionId = readLinkSessionId(userId)
  if (!sessionId) return
  try {
    await apiClient.post('/api/message-e2ee/devices/link/complete', { sessionId, deviceId })
  } catch {
    // Session bookkeeping is best-effort; crypto ownership already applied locally.
  } finally {
    writeLinkSessionId(userId, '')
  }
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function writeOwnsIdentity(userId: string, owns: boolean) {
  service?.store.setOwnsIdentity(owns)
  localStorage.setItem(storageKey(userId, 'owns-identity'), owns ? 'yes' : 'no')
}

function memberKey(threadId: string) {
  return `cribstalk.signal.members.${threadId}`
}

async function postCrypto(type: number | string, deviceId: string, body: unknown) {
  return apiClient.post<Record<string, unknown>>('/api/message-e2ee/request', {
    type,
    deviceId,
    body: JSON.stringify(body),
  })
}

async function publishKeys(current: SignalEncryptionService, replenishOtks = false) {
  const uploaded = await current.publicUploadBundle({ replenishOtks })
  const result = await postCrypto('register', current.deviceId, {
    identity_key: uploaded.keys.identityPublicKey,
    registration_id: uploaded.keys.registrationId,
    signed_prekey: {
      key_id: uploaded.keys.signedPreKey.keyId,
      public_key: uploaded.keys.signedPreKey.publicKey,
      signature: uploaded.keys.signedPreKey.signature,
    },
    one_time_prekeys: uploaded.keys.oneTimePreKeys.map((item) => ({
      key_id: item.keyId,
      public_key: item.publicKey,
    })),
    device_name: uploaded.deviceName,
    platform: uploaded.platform,
  })
  if (result?.is_first_device === true) {
    writeOwnsIdentity(current.userId, true)
  } else if (localStorage.getItem(storageKey(current.userId, 'owns-identity')) !== 'yes') {
    // Keep prior owner flag; new devices stay non-owner until linked.
    if (!current.store.getOwnsIdentity()) {
      writeOwnsIdentity(current.userId, false)
      await ensureLinkSession(current, uploaded.keys.identityPublicKey)
    }
  }
  return result
}

/** Apply local ownership when a trusted device has approved this device's link session. */
async function syncLinkOwnership(current: SignalEncryptionService) {
  if (current.store.getOwnsIdentity()) return
  const sessionId = readLinkSessionId(current.userId)
  if (!sessionId) return
  try {
    const status = await apiClient.get<{ status?: string }>(
      `/api/message-e2ee/devices/link/session/${encodeURIComponent(sessionId)}`,
    )
    if (status?.status !== 'approved' && status?.status !== 'completed') return
    writeOwnsIdentity(current.userId, true)
    if (status.status === 'approved') {
      await completeOpenLinkSession(current.userId, current.deviceId)
    } else {
      writeLinkSessionId(current.userId, '')
    }
    keyListeners.forEach((listener) => listener())
  } catch {
    // Session poll is best-effort; UI also polls while the link modal is open.
  }
}

async function openService(userId: string): Promise<SignalEncryptionService> {
  if (service && activeUserId === userId) return service
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new Error(
      'End-to-end encryption needs a secure context (HTTPS or localhost). Open this site over HTTPS.',
    )
  }
  const { deviceId, passphrase } = deviceCredentials(userId)
  const next = new SignalEncryptionService(userId, deviceId, passphrase)
  await next.initialize()
  if (localStorage.getItem(storageKey(userId, 'owns-identity')) === 'yes') {
    next.store.setOwnsIdentity(true)
  }
  await publishKeys(next, true)
  service = next
  activeUserId = userId
  if (pollTimer == null) {
    pollTimer = window.setInterval(() => {
      void enqueue(async () => {
        if (!service || !activeUserId) return
        await syncLinkOwnership(service)
      }).catch(() => undefined)
    }, 4000)
  }
  return next
}

async function withService<T>(userId: string, task: (current: SignalEncryptionService) => Promise<T>) {
  return enqueue(async () => {
    const current = await openService(userId)
    await syncLinkOwnership(current)
    return task(current)
  })
}

async function participantIds(threadId: string, userId: string): Promise<string[]> {
  const res = await apiClient.get<Array<{ user_id?: string }> | { data?: Array<{ user_id?: string }> }>(
    `/api/chat/threads/${threadId}/participants`,
  )
  const rows = Array.isArray(res) ? res : (res?.data ?? [])
  return [...new Set([userId, ...rows.map((row) => row.user_id || '').filter(Boolean)])]
}

function rememberMembers(threadId: string, ids: string[]): boolean {
  const key = memberKey(threadId)
  const next = [...ids].sort()
  const previous = (sessionStorage.getItem(key) || '').split(',').filter(Boolean)
  sessionStorage.setItem(key, next.join(','))
  if (previous.length === 0) return false
  const nextSet = new Set(next)
  return previous.some((id) => !nextSet.has(id))
}

async function fetchDevices(
  current: SignalEncryptionService,
  userIds: string[],
): Promise<DeviceKeyBundle[]> {
  const listed = await postCrypto('devices', current.deviceId, { user_ids: userIds })
  const devicesMap = (listed?.devices || {}) as Record<string, Array<Record<string, unknown>>>
  const bundles: DeviceKeyBundle[] = []
  for (const userId of userIds) {
    const rows = Array.isArray(devicesMap[userId]) ? devicesMap[userId]! : []
    for (const row of rows) {
      const deviceId = typeof row.device_id === 'string' ? row.device_id : ''
      if (!deviceId || (userId === current.userId && deviceId === current.deviceId)) continue
      const signed = (row.signed_prekey || {}) as Record<string, unknown>
      bundles.push({
        userId,
        deviceId,
        identityKey: typeof row.identity_key === 'string' ? row.identity_key : '',
        registrationId: typeof row.registration_id === 'number' ? row.registration_id : Number(row.registration_id),
        signedPreKey: {
          keyId: typeof signed.key_id === 'number' ? signed.key_id : Number(signed.key_id),
          publicKey: typeof signed.public_key === 'string' ? signed.public_key : '',
          signature: typeof signed.signature === 'string' ? signed.signature : '',
        },
        deviceName: typeof row.device_name === 'string' ? row.device_name : undefined,
        platform: typeof row.platform === 'string' ? row.platform : undefined,
        lastSeenAt: typeof row.last_seen_at === 'string' ? row.last_seen_at : undefined,
      })
    }
  }
  return bundles.filter((item) => item.identityKey && item.signedPreKey.publicKey)
}

async function ensureSession(current: SignalEncryptionService, target: DeviceKeyBundle) {
  if (await current.hasSession(target.userId, target.deviceId)) return
  const claimed = await postCrypto('claim', current.deviceId, {
    user_id: target.userId,
    device_id: target.deviceId,
  })
  const bundle = (claimed?.bundle || {}) as Record<string, unknown>
  const signed = (bundle.signed_prekey || {}) as Record<string, unknown>
  const otk = (bundle.one_time_prekey || null) as Record<string, unknown> | null
  await current.createSession({
    userId: target.userId,
    deviceId: target.deviceId,
    identityKey: typeof bundle.identity_key === 'string' ? bundle.identity_key : target.identityKey,
    registrationId:
      typeof bundle.registration_id === 'number' ? bundle.registration_id : target.registrationId,
    signedPreKey: {
      keyId: typeof signed.key_id === 'number' ? signed.key_id : target.signedPreKey.keyId,
      publicKey: typeof signed.public_key === 'string' ? signed.public_key : target.signedPreKey.publicKey,
      signature: typeof signed.signature === 'string' ? signed.signature : target.signedPreKey.signature,
    },
    oneTimePreKey: otk
      ? {
          keyId: typeof otk.key_id === 'number' ? otk.key_id : Number(otk.key_id),
          publicKey: typeof otk.public_key === 'string' ? otk.public_key : '',
        }
      : null,
  })
}

function msgtypeFor(messageType: string | undefined, attachments: ChatAttachment[]): string {
  if (attachments.some((item) => item.type === 'image' || item.mimeType.startsWith('image/'))) return 'image'
  if (attachments.some((item) => item.type === 'video' || item.mimeType.startsWith('video/'))) return 'video'
  if (attachments.some((item) => item.mimeType.startsWith('audio/'))) return 'audio'
  if (attachments.length > 0) return 'file'
  return messageType || 'text'
}

export async function tryEncryptOutgoing(input: {
  userId: string
  threadId: string
  messageType?: string
  content: string
  attachments?: ChatAttachment[]
}): Promise<EncryptResult> {
  if (!(await messageE2eeActive())) return { mode: 'off' }
  const attachments = input.attachments || []
  const sealed = attachments.filter((item) => item.sealed)
  try {
    return await withService(input.userId, async (current) => {
      const ids = await participantIds(input.threadId, input.userId)
      rememberMembers(input.threadId, ids)
      const devices = await fetchDevices(current, ids)
      if (devices.length === 0) {
        return { mode: 'fallback', reason: 'no-devices' }
      }
      const plaintext = JSON.stringify({
        msgtype: msgtypeFor(input.messageType, attachments),
        body: input.content || '',
        attachments: sealed.map((item) => ({
          name: item.sealed!.plainName,
          mime: item.sealed!.plainMime,
          size: item.sealed!.plainSize,
          sha256: item.sealed!.sha256,
          key: item.sealed!.key,
          url: item.url,
        })),
      })
      const envelopes: EncryptedEnvelope[] = []
      for (const device of devices) {
        await ensureSession(current, device)
        const encrypted = await current.encryptMessage(device.deviceId, device.userId, plaintext)
        envelopes.push({
          recipient_user_id: device.userId,
          recipient_device_id: device.deviceId,
          type: encrypted.type,
          body: encrypted.body,
        })
      }
      if (envelopes.length === 0) return { mode: 'fallback', reason: 'no-envelopes' }
      // Ciphertext column stores only the Signal body (first envelope). Extra
      // recipient devices are relayed via envelopes[] → signal_message_envelopes.
      const primary = envelopes[0]!
      return {
        mode: 'signal' as const,
        ciphertext: primary.body,
        senderDeviceId: current.deviceId,
        e2eeVersion: SIGNAL_E2EE_VERSION,
        envelopes,
      }
    })
  } catch (error) {
    if (sealed.length > 0) {
      throw new Error('Attachment was uploaded as ciphertext and could not be sealed into the message')
    }
    console.warn('[message-e2ee] signal send failed', {
      threadId: input.threadId,
      reason: error instanceof Error ? error.name : 'error',
    })
    return { mode: 'fallback', reason: error instanceof Error ? error.name : 'error' }
  }
}

async function openAttachment(url: string, key: string, sha256: string, mime: string): Promise<string | null> {
  const response = await fetch(url)
  if (!response.ok) return null
  const sealed = new Uint8Array(await response.arrayBuffer())
  const blob = await decryptSealedBytes(sealed, key, sha256)
  return URL.createObjectURL(new Blob([blob], { type: mime || 'application/octet-stream' }))
}

async function accountUserId(): Promise<string> {
  if (activeUserId) return activeUserId
  const { data } = await (await import('@/lib/supabase')).supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) throw new Error('signed-out')
  return userId
}

export async function decryptStoredMessage(message: ChatMessage): Promise<ChatMessage> {
  if (message.e2ee_version === LEGACY_MEGOLM_VERSION) {
    return { ...message, content: LOCKED, e2ee_locked: true, attachments: [] }
  }
  if (message.e2ee_version !== SIGNAL_E2EE_VERSION) return message
  const hasCiphertext = Boolean(message.ciphertext)
  const hasEnvelopes = Array.isArray(message.envelopes) && message.envelopes.length > 0
  if (!hasCiphertext && !hasEnvelopes) return message
  const cached = decryptCache.get(message.id)
  if (cached && cached.ciphertext === message.ciphertext) return { ...message, ...cached, sender: message.sender }
  if (!(await messageE2eeActive())) {
    return { ...message, content: LOCKED, e2ee_locked: true, attachments: [] }
  }
  try {
    const userId = await accountUserId()
    const senderDeviceId = message.sender_device_id || ''
    const opened = await withService(userId, async (current) => {
      const fromList = pickEnvelopeForDevice(message.envelopes ?? undefined, userId, current.deviceId)
      let type = fromList?.type
      let body = fromList?.body
      let senderDevice = senderDeviceId

      if (!body && message.ciphertext) {
        const legacy = parseEncryptedMessage(message.ciphertext)
        if (legacy) {
          const mine = pickEnvelopeForDevice(legacy.envelopes, userId, current.deviceId)
          if (!mine) throw new Error('no-envelope')
          type = mine.type
          body = mine.body
          senderDevice = legacy.sender_device_id || senderDeviceId
        } else if (isRawSignalBody(message.ciphertext)) {
          body = message.ciphertext
        }
      }

      if (!body || !senderDevice) throw new Error('no-envelope')

      const tryDecrypt = async (messageType: number) =>
        current.decryptMessage(message.sender_id, senderDevice, { type: messageType, body: body! })

      let plain: string
      if (type === 1 || type === 3) {
        plain = await tryDecrypt(type)
      } else {
        try {
          plain = await tryDecrypt(3)
        } catch {
          plain = await tryDecrypt(1)
        }
      }
      return JSON.parse(plain) as {
        body?: string
        attachments?: Array<Record<string, unknown>>
      }
    })
    const sealedAttachments = Array.isArray(opened.attachments) ? opened.attachments : []
    const attachments: ChatAttachment[] = []
    for (const item of sealedAttachments) {
      const url = typeof item.url === 'string' ? item.url : ''
      const key = typeof item.key === 'string' ? item.key : ''
      const sha256 = typeof item.sha256 === 'string' ? item.sha256 : ''
      const mime = typeof item.mime === 'string' ? item.mime : 'application/octet-stream'
      if (!url || !key || !sha256) continue
      try {
        const blobUrl = await openAttachment(url, key, sha256, mime)
        if (!blobUrl) continue
        const name = typeof item.name === 'string' ? item.name : 'file'
        attachments.push({
          id: `${message.id}:${sha256.slice(0, 12)}`,
          name,
          url: blobUrl,
          type: mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'file',
          size: typeof item.size === 'number' ? item.size : 0,
          mimeType: mime,
          sealed: {
            key,
            sha256,
            plainSize: typeof item.size === 'number' ? item.size : 0,
            plainName: name,
            plainMime: mime,
          },
        })
      } catch (error) {
        console.warn('[message-e2ee] attachment decrypt failed', {
          messageId: message.id,
          reason: error instanceof Error ? error.name : 'error',
        })
      }
    }
    const next: ChatMessage = {
      ...message,
      content: typeof opened.body === 'string' ? opened.body : '',
      attachments: attachments.length > 0 ? attachments : message.attachments,
      e2ee_locked: false,
    }
    decryptCache.set(message.id, next)
    return next
  } catch (error) {
    console.warn('[message-e2ee] decrypt failed', {
      messageId: message.id,
      reason: error instanceof Error ? error.name : 'error',
    })
    return { ...message, content: LOCKED, e2ee_locked: true, attachments: [] }
  }
}

export async function rotateThreadSession(threadId: string, _userId: string): Promise<void> {
  // Signal has no shared group session; membership shrink just stops targeting left devices.
  sessionStorage.removeItem(memberKey(threadId))
}

export function onMessageKeys(listener: () => void): () => void {
  keyListeners.add(listener)
  return () => keyListeners.delete(listener)
}

export async function encryptionDeviceStatus(
  userId: string,
): Promise<{ deviceId: string; ownsIdentity: boolean; payload: string }> {
  if (!(await messageE2eeActive())) throw new Error('off')
  const local = readLocalLinkDeviceInfo(userId)
  return withService(userId, async (current) => ({
    deviceId: current.deviceId,
    ownsIdentity: current.store.getOwnsIdentity() || local.ownsIdentity,
    payload: linkPayload(userId, current.deviceId),
  }))
}

export async function linkDeviceFromPayload(userId: string, payload: string): Promise<void> {
  const parsed = normalizeLinkInput(payload, userId)
  if (!parsed) {
    throw new Error('That is not a valid device code. Paste the full code or the other browser’s device id.')
  }
  if (parsed.userId !== userId) throw new Error('This QR code is for a different account')
  await withService(userId, async (current) => {
    if (!current.store.getOwnsIdentity()) {
      throw new Error('This device does not hold the account encryption keys')
    }
    if (parsed.deviceId === current.deviceId) {
      throw new Error('That code is for this browser. Paste the other browser’s code instead.')
    }
    const devices = await fetchDevices(current, [userId])
    const target = devices.find((item) => item.deviceId === parsed.deviceId)
    if (!target) {
      throw new Error(
        'That browser has not published encryption keys yet. Open Link a device on it, wait a few seconds, then try again.',
      )
    }

    // Linking is session-based: validate open QR session, then mark approved.
    let open: {
      sessionId?: string
      publicKey?: string
      status?: string
    } | null = null
    try {
      open = await apiClient.get<{
        sessionId?: string
        publicKey?: string
        status?: string
      } | null>('/api/message-e2ee/devices/link/open', {
        device_id: parsed.deviceId,
      })
    } catch (error) {
      const details = error as { details?: { code?: string }; message?: string }
      const code = details?.details?.code || ''
      if (
        code === 'LINK_SESSION_EXPIRED' ||
        code === 'LINK_SESSION_ALREADY_USED' ||
        code === 'DEVICE_PUBLIC_KEY_MISMATCH' ||
        code === 'USER_MISMATCH' ||
        code === 'DEVICE_NOT_AUTHORIZED'
      ) {
        throw error instanceof Error ? error : new Error(details?.message || 'Device approval failed')
      }
      throw error instanceof Error
        ? error
        : new Error('That browser’s linking session expired or is missing. Open Link a device on it again.')
    }
    if (!open?.sessionId || !open.publicKey) {
      throw new Error(
        'That browser’s linking session expired or is missing. Open Link a device on it again, then scan.',
      )
    }
    if (open.publicKey !== target.identityKey) {
      throw new Error('The device public key does not match the registered keys')
    }

    await apiClient
      .post('/api/message-e2ee/devices/link/approve', {
        sessionId: open.sessionId,
        deviceId: parsed.deviceId,
        publicKey: open.publicKey,
        approverDeviceId: current.deviceId,
        markScannedOnly: true,
      })
      .catch(() => undefined)

    current.store.setDeviceVerified(userId, target.deviceId, true)
    await current.store.flush()

    await apiClient.post('/api/message-e2ee/devices/link/approve', {
      sessionId: open.sessionId,
      deviceId: parsed.deviceId,
      publicKey: open.publicKey,
      approverDeviceId: current.deviceId,
    })
  })
}

export async function listLinkedDevices(userId: string): Promise<
  Array<{
    deviceId: string
    deviceName: string
    platform: string
    deviceType: string
    createdAt: string
    lastSeenAt: string
    verified: boolean
    isCurrent: boolean
    identityChanged: boolean
    status: 'trusted' | 'untrusted'
  }>
> {
  if (!(await messageE2eeActive())) return []
  return withService(userId, async (current) => {
    try {
      const listed = await apiClient.get<{
        devices?: Array<{
          deviceId: string
          deviceName: string
          platform: string
          deviceType: string
          createdAt: string
          lastSeenAt: string
          isCurrentDevice: boolean
          status: string
        }>
      }>('/api/message-e2ee/devices', { device_id: current.deviceId })
      const rows = Array.isArray(listed?.devices) ? listed.devices : []
      if (rows.length > 0) {
        return rows.map((row) => ({
          deviceId: row.deviceId,
          deviceName: row.deviceName || 'Device',
          platform: row.platform || 'web',
          deviceType: row.deviceType || 'browser',
          createdAt: row.createdAt || '',
          lastSeenAt: row.lastSeenAt || '',
          verified: row.deviceId === current.deviceId || current.store.isDeviceVerified(userId, row.deviceId),
          isCurrent: row.deviceId === current.deviceId,
          identityChanged: current.store.hasIdentityChange(userId, row.deviceId),
          status: (row.status === 'trusted' ? 'trusted' : 'untrusted') as 'trusted' | 'untrusted',
        }))
      }
    } catch {
      // Fall back to peer-device list below.
    }

    const devices = await fetchDevices(current, [userId])
    const meta = current.store.getDeviceMeta()
    const mine = {
      deviceId: current.deviceId,
      deviceName: meta.deviceName,
      platform: meta.platform,
      deviceType: 'browser',
      createdAt: '',
      lastSeenAt: new Date().toISOString(),
      verified: true,
      isCurrent: true,
      identityChanged: false,
      status: 'trusted' as const,
    }
    const others = devices.map((device) => ({
      deviceId: device.deviceId,
      deviceName: device.deviceName || 'Device',
      platform: device.platform || 'web',
      deviceType: 'browser',
      createdAt: '',
      lastSeenAt: device.lastSeenAt || '',
      verified: current.store.isDeviceVerified(userId, device.deviceId),
      isCurrent: false,
      identityChanged: current.store.hasIdentityChange(userId, device.deviceId),
      status: (current.store.isDeviceVerified(userId, device.deviceId) ? 'trusted' : 'untrusted') as
        | 'trusted'
        | 'untrusted',
    }))
    return [mine, ...others]
  })
}

export async function verifyDevice(userId: string, deviceId: string): Promise<void> {
  await withService(userId, async (current) => {
    current.store.setDeviceVerified(userId, deviceId, true)
    current.store.clearIdentityChange(userId, deviceId)
    await current.store.flush()
  })
}

export async function removeLinkedDevice(userId: string, deviceId: string): Promise<void> {
  await withService(userId, async (current) => {
    if (deviceId === current.deviceId) throw new Error('Cannot remove the current device here')
    if (!current.store.getOwnsIdentity()) {
      throw new Error('Only a verified owner device can remove linked devices')
    }
    try {
      await apiClient.delete(`/api/message-e2ee/devices/${encodeURIComponent(deviceId)}`, {
        requesterDeviceId: current.deviceId,
      })
    } catch {
      await postCrypto('revoke', current.deviceId, { device_id: deviceId })
    }
  })
}

/** Create / refresh a server link session for the current (often unlinked) device. */
export async function createLinkSession(
  userId: string,
): Promise<LinkSessionCreateResult & { payload: string; ownsIdentity: boolean }> {
  if (!(await messageE2eeActive())) throw new Error('off')
  return withService(userId, async (current) => {
    const local = readLocalLinkDeviceInfo(userId)
    if (current.store.getOwnsIdentity() || local.ownsIdentity) {
      return {
        sessionId: '',
        deviceId: current.deviceId,
        expiresAt: '',
        status: 'trusted',
        qrPayload: linkPayload(userId, current.deviceId),
        payload: linkPayload(userId, current.deviceId),
        ownsIdentity: true,
      }
    }
    const created = await ensureLinkSession(current, undefined, true)
    const payload = created?.qrPayload || linkPayload(userId, current.deviceId)
    return {
      sessionId: created?.sessionId || readLinkSessionId(userId),
      deviceId: current.deviceId,
      expiresAt: created?.expiresAt || '',
      status: created?.status || 'pending',
      qrPayload: payload,
      payload,
      ownsIdentity: false,
    }
  })
}

export async function getLinkSessionStatus(
  userId: string,
  sessionId?: string,
): Promise<{ sessionId: string; status: string; deviceId?: string; expiresAt?: string } | null> {
  const id = sessionId || readLinkSessionId(userId)
  if (!id) return null
  try {
    return await apiClient.get(`/api/message-e2ee/devices/link/session/${encodeURIComponent(id)}`)
  } catch {
    return null
  }
}

export async function safetyNumberForUser(userId: string, otherUserId: string): Promise<string> {
  if (!(await messageE2eeActive())) throw new Error('off')
  return withService(userId, async (current) => {
    const devices = await fetchDevices(current, [otherUserId])
    const primary = devices[0]
    if (!primary?.identityKey) {
      throw new Error('That person has not set up encryption on a device yet')
    }
    return current.safetyNumber(otherUserId, primary.identityKey)
  })
}
