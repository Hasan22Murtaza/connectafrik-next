import { apiClient, ApiError } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'
import { deviceLabelFromUserAgent } from '@/shared/utils/sessionDeviceLabel'
import { arrayBufferToBase64, asArrayBuffer } from './bytes'
import { decryptBackup, decryptFileBytes, encryptBackup, encryptFileBytes, type EncryptedBackup } from './media'
import {
  decryptFromDevice,
  encryptForDevice,
  establishSession,
  generatePreKeys,
  hasSession,
  provisionAccount,
  rotateSignedPreKey,
} from './protocol'
import {
  DIRECTORY_CACHE_MS,
  E2EE_VERSION,
  PREKEY_BATCH,
  PREKEY_REPLENISH_BELOW,
  SIGNED_PREKEY_ROTATION_MS,
  UNAVAILABLE_ON_DEVICE_TEXT,
  UNDECRYPTABLE_TEXT,
  type DeviceBundle,
  type DeviceDirectoryEntry,
  type E2eeEnvelope,
  type PlaintextPayload,
  type UploadEncryptionMaterial,
} from './types'
import { messageTypeUsesE2ee, type EnvelopeRowInput } from './server'
import type { SerializedSignalStore } from './memoryStore'
import { E2eeVault, type VaultMeta } from './vault'

const vault = new E2eeVault()
let openUserId: string | null = null
const directoryCache = new Map<string, { at: number; entries: DeviceDirectoryEntry[] }>()
const participantCache = new Map<string, { at: number; ids: string[] }>()
const threadDecisionCache = new Map<string, { at: number; encrypt: boolean; directory: DeviceDirectoryEntry[] }>()
const pendingSends = new Map<string, PreparedSend>()
const blobUrls = new Map<string, string>()

export interface PreparedAttachment {
  name: string
  size: number
  mimeType: string
  url: string
  type?: string
  e2ee?: UploadEncryptionMaterial
}

export interface PreparedSend {
  content: string
  metadata: Record<string, unknown> | null
  attachments: Array<{ name: string; size: number; mimeType: string; url: string }>
  e2ee_version?: number
  sender_device_id?: number
  envelopes?: EnvelopeRowInput[]
  localPayload?: PlaintextPayload | null
}

export interface PresentableMessage {
  id: string
  thread_id: string
  sender_id: string
  content: string
  message_type?: string
  metadata?: Record<string, unknown>
  view_once?: boolean
  e2ee_version?: number | null
  e2ee_sender_device_id?: number | null
  e2ee_envelopes?: Array<{ recipient_device_id: number; message_type: number; ciphertext: string }>
  e2ee_status?: 'legacy' | 'decrypted' | 'failed'
  e2ee_error?: string
  attachments?: Array<{
    id: string
    name: string
    url: string
    type: 'image' | 'video' | 'file'
    size: number
    mimeType: string
  }>
}

async function withLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (locks?.request) return locks.request('cribstalk-e2ee', task)
  return task()
}

let cachedUserId = ''
let cachedUserAt = 0

async function requireUserId(): Promise<string> {
  if (cachedUserId && Date.now() - cachedUserAt < 60_000) return cachedUserId
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id
  if (!userId) throw new Error('Not signed in')
  cachedUserId = userId
  cachedUserAt = Date.now()
  return userId
}

function deviceName(): string {
  if (typeof navigator === 'undefined') return 'Web browser'
  return deviceLabelFromUserAgent(navigator.userAgent)
}

let lastMaintainAt = 0
let maintainInFlight: Promise<void> | null = null

function scheduleMaintain(meta: VaultMeta): void {
  if (maintainInFlight) return
  if (Date.now() - lastMaintainAt < 60_000) return
  lastMaintainAt = Date.now()
  // Network stays outside the encryption lock so a heartbeat cannot delay Send.
  maintainInFlight = maintainDevice(meta)
    .catch(() => undefined)
    .finally(() => {
      maintainInFlight = null
    })
}

async function openDevice(userId: string): Promise<VaultMeta | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return null
  if (openUserId !== userId) {
    await vault.openForUser(userId)
    openUserId = userId
  }
  const meta = vault.getMeta()
  if (!meta?.deviceId) {
    await registerNewDevice(userId)
  } else {
    scheduleMaintain(meta)
  }
  return vault.getMeta()
}

export async function ensureDevice(): Promise<VaultMeta | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return null
  const userId = await requireUserId()
  return withLock(() => openDevice(userId))
}

async function registerNewDevice(userId: string): Promise<VaultMeta> {
  const store = vault.getSignalStore()
  const account = await provisionAccount(store)
  const name = deviceName()
  const created = await apiClient.post<{ device_id: number }>('/api/e2ee/devices', {
    device_name: name,
    registration_id: account.registrationId,
    identity_key_public: arrayBufferToBase64(account.identityKeyPair.pubKey),
    signed_prekey: {
      key_id: account.signedPreKeyPublic.keyId,
      public_key: account.signedPreKeyPublic.publicKey,
      signature: account.signedPreKeyPublic.signature,
    },
    prekeys: account.preKeys.map((preKey) => ({ key_id: preKey.keyId, public_key: preKey.publicKey })),
  })
  const meta: VaultMeta = {
    userId,
    deviceId: created.device_id,
    deviceName: name,
    registrationId: account.registrationId,
    signedPreKeyId: account.signedPreKeyId,
    signedPreKeyPublic: account.signedPreKeyPublic.publicKey,
    signedPreKeySignature: account.signedPreKeyPublic.signature,
    signedPreKeyCreatedAt: account.signedPreKeyCreatedAt,
    nextPreKeyId: account.nextPreKeyId,
  }
  vault.setMeta(meta)
  await vault.flush()
  return meta
}

async function maintainDevice(meta: VaultMeta): Promise<void> {
  let current = meta
  if (Date.now() - current.signedPreKeyCreatedAt > SIGNED_PREKEY_ROTATION_MS) {
    const next = await withLock(async () => {
      const rotated = await rotateSignedPreKey(vault.getSignalStore(), current.signedPreKeyId + 1)
      vault.setMeta({
        ...current,
        signedPreKeyId: rotated.keyId,
        signedPreKeyPublic: rotated.publicKey,
        signedPreKeySignature: rotated.signature,
        signedPreKeyCreatedAt: Date.now(),
      })
      await vault.flush()
      return rotated
    })
    await apiClient.post('/api/e2ee/signed-prekey', {
      device_id: current.deviceId,
      signed_prekey: { key_id: next.keyId, public_key: next.publicKey, signature: next.signature },
    })
    current = vault.getMeta() || current
  }
  const own = await apiClient.get<{ devices: DeviceDirectoryEntry[] }>('/api/e2ee/devices')
  const row = (own.devices || []).find((device) => device.deviceId === current.deviceId)
  if (row && typeof row.prekeysRemaining === 'number' && row.prekeysRemaining < PREKEY_REPLENISH_BELOW) {
    const preKeys = await withLock(async () => {
      const generated = await generatePreKeys(vault.getSignalStore(), current.nextPreKeyId, PREKEY_BATCH)
      vault.setMeta({ ...current, nextPreKeyId: current.nextPreKeyId + generated.length })
      await vault.flush()
      return generated
    })
    await apiClient.post('/api/e2ee/prekeys', {
      device_id: current.deviceId,
      prekeys: preKeys.map((preKey) => ({ key_id: preKey.keyId, public_key: preKey.publicKey })),
    })
  }
  void apiClient.post('/api/e2ee/devices/heartbeat', { device_id: current.deviceId }).catch(() => undefined)
}

export function clearEncryptionCache(threadId?: string): void {
  if (threadId) {
    threadDecisionCache.delete(threadId)
    participantCache.delete(threadId)
  } else {
    threadDecisionCache.clear()
    participantCache.clear()
  }
  directoryCache.clear()
}

function rememberParticipants(threadId: string, ids: string[]): string[] {
  const unique = [...new Set(ids.filter(Boolean))]
  participantCache.set(threadId, { at: Date.now(), ids: unique })
  return unique
}

async function participantIds(threadId: string, known?: string[], fresh = false): Promise<string[]> {
  if (!fresh && known && known.length > 0) return rememberParticipants(threadId, known)
  if (!fresh) {
    const cached = participantCache.get(threadId)
    if (cached && Date.now() - cached.at < DIRECTORY_CACHE_MS) return cached.ids
  }
  const rows = await apiClient.get<Array<{ user_id: string }>>(`/api/chat/threads/${threadId}/participants`)
  const list = Array.isArray(rows) ? rows : []
  return rememberParticipants(
    threadId,
    list.map((row) => row.user_id)
  )
}

async function loadDirectory(userIds: string[], fresh = false): Promise<DeviceDirectoryEntry[]> {
  const key = [...userIds].sort().join(',')
  const cached = directoryCache.get(key)
  if (!fresh && cached && Date.now() - cached.at < DIRECTORY_CACHE_MS) return cached.entries
  if (userIds.length === 0) return []
  const entries = await apiClient.get<DeviceDirectoryEntry[]>('/api/e2ee/directory', {
    user_ids: key,
  })
  const list = Array.isArray(entries) ? entries : []
  directoryCache.set(key, { at: Date.now(), entries: list })
  return list
}

interface ThreadCrypto {
  encrypt: boolean
  meta: VaultMeta | null
  directory: DeviceDirectoryEntry[]
}

async function loadThreadCrypto(
  threadId: string,
  options?: { fresh?: boolean; participantIds?: string[] }
): Promise<ThreadCrypto> {
  const fresh = Boolean(options?.fresh)
  if (!fresh) {
    const cached = threadDecisionCache.get(threadId)
    if (cached && Date.now() - cached.at < DIRECTORY_CACHE_MS) {
      const meta = vault.getMeta() || (await ensureDevice())
      return { encrypt: cached.encrypt, meta, directory: cached.directory }
    }
  }
  const meta = await ensureDevice()
  if (!meta) return { encrypt: false, meta: null, directory: [] }
  const ids = await participantIds(threadId, options?.participantIds, fresh)
  const directory = await loadDirectory(ids, fresh)
  const encrypt = ids.length > 0 && ids.every((id) => directory.some((device) => device.userId === id))
  threadDecisionCache.set(threadId, { at: Date.now(), encrypt, directory })
  return { encrypt, meta, directory }
}

function targetsFor(meta: VaultMeta, directory: DeviceDirectoryEntry[]): DeviceDirectoryEntry[] {
  return directory.filter((device) => !(device.userId === meta.userId && device.deviceId === meta.deviceId))
}

let sessionChain: Promise<void> = Promise.resolve()

async function ensureSessionsOnce(targets: DeviceDirectoryEntry[]): Promise<void> {
  const store = vault.getSignalStore()
  const missing: DeviceDirectoryEntry[] = []
  for (const device of targets) {
    if (!(await hasSession(store, device.userId, device.deviceId))) missing.push(device)
  }
  if (missing.length === 0) return
  const bundles = await apiClient.post<DeviceBundle[]>('/api/e2ee/bundles', {
    devices: missing.map((device) => ({ user_id: device.userId, device_id: device.deviceId })),
  })
  await withLock(async () => {
    for (const bundle of bundles || []) {
      await establishSession(store, bundle)
    }
  })
}

function ensureSessions(targets: DeviceDirectoryEntry[]): Promise<void> {
  const run = sessionChain.then(() => ensureSessionsOnce(targets))
  sessionChain = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

export async function shouldEncryptThread(threadId: string, knownParticipantIds?: string[]): Promise<boolean> {
  try {
    const snapshot = await loadThreadCrypto(threadId, { participantIds: knownParticipantIds })
    return snapshot.encrypt
  } catch {
    return false
  }
}

/** Fetch keys and open Signal sessions when a chat opens, so Send does not wait on them. */
export async function warmThreadEncryption(threadId: string, knownParticipantIds?: string[]): Promise<void> {
  try {
    const snapshot = await loadThreadCrypto(threadId, { participantIds: knownParticipantIds })
    if (!snapshot.encrypt || !snapshot.meta) return
    await ensureSessions(targetsFor(snapshot.meta, snapshot.directory))
    await vault.flush()
  } catch {
    // The send path retries this if the chat is opened and sent in the same moment.
  }
}

export async function encryptBrowserFile(file: File): Promise<{ file: File; material: UploadEncryptionMaterial }> {
  const encrypted = await encryptFileBytes(new Uint8Array(await file.arrayBuffer()))
  const mime = file.type || 'application/octet-stream'
  const type: UploadEncryptionMaterial['originalType'] = mime.startsWith('image/')
    ? 'image'
    : mime.startsWith('video/')
      ? 'video'
      : 'file'
  return {
    file: new File([asArrayBuffer(encrypted.ciphertext)], 'encrypted.bin', { type: 'application/octet-stream' }),
    material: {
      key: encrypted.key,
      iv: encrypted.iv,
      originalName: file.name || 'file',
      originalMime: mime,
      originalSize: file.size,
      originalType: type,
    },
  }
}

export async function prepareOutgoingMessage(input: {
  threadId: string
  content: string
  messageType?: string
  metadata?: Record<string, unknown> | null
  attachments?: PreparedAttachment[]
  participantIds?: string[]
  clientSendId?: string
  force?: boolean
}): Promise<PreparedSend> {
  const messageType = input.messageType || 'text'
  const metadata = input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : null
  const legacy = (): PreparedSend => ({
    content: input.content,
    metadata,
    attachments: (input.attachments || []).map((attachment) => ({
      name: attachment.name,
      size: attachment.size,
      mimeType: attachment.mimeType,
      url: attachment.url,
    })),
  })

  if (!messageTypeUsesE2ee(messageType)) return legacy()
  if (input.clientSendId && !input.force) {
    const pending = pendingSends.get(input.clientSendId)
    if (pending) return pending
  }

  const snapshot = await loadThreadCrypto(input.threadId, {
    fresh: Boolean(input.force),
    participantIds: input.participantIds,
  })
  if (!snapshot.encrypt || !snapshot.meta) return legacy()
  const meta = snapshot.meta
  const targets = targetsFor(meta, snapshot.directory)
  const store = vault.getSignalStore()

  const secrets = (input.attachments || []).filter((attachment) => attachment.e2ee)
  if ((input.attachments || []).some((attachment) => attachment.url && !attachment.e2ee && attachment.url.startsWith('http'))) {
    throw new Error('Attachment was uploaded without encryption. Try sending again.')
  }

  const payload: PlaintextPayload = {
    v: 1,
    text: input.content || '',
    attachments: secrets.map((attachment) => ({
      name: attachment.e2ee!.originalName,
      mime: attachment.e2ee!.originalMime,
      size: attachment.e2ee!.originalSize,
      url: attachment.url,
      key: attachment.e2ee!.key,
      iv: attachment.e2ee!.iv,
    })),
  }
  const encoded = JSON.stringify(payload)

  try {
    await ensureSessions(targets)
    const envelopes: E2eeEnvelope[] = []
    for (const device of targets) {
      envelopes.push(await encryptForDevice(store, device.userId, device.deviceId, encoded))
    }
    await vault.flush()
    if (input.clientSendId) {
      await vault.cachePlaintext(`send:${input.clientSendId}`, input.threadId, payload)
    }
    const prepared: PreparedSend = {
      content: '',
      metadata: metadata ? stripClientMetadata(metadata) : null,
      attachments: (input.attachments || []).map((attachment) => publicAttachment(attachment)),
      e2ee_version: E2EE_VERSION,
      sender_device_id: meta.deviceId,
      envelopes: envelopes.map((envelope) => ({
        recipient_user_id: envelope.recipientUserId,
        recipient_device_id: envelope.recipientDeviceId,
        message_type: envelope.messageType,
        ciphertext: envelope.ciphertext,
      })),
      localPayload: payload,
    }
    if (input.clientSendId) pendingSends.set(input.clientSendId, prepared)
    return prepared
  } catch (error) {
    if (error instanceof Error && error.message === 'Identity key changed') {
      throw new Error('This contact’s encryption key changed, so the message was not sent.')
    }
    throw error
  }
}

function stripClientMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const next = { ...metadata }
  for (const key of ['previewText', 'caption', 'plaintext', 'body', 'text', 'note']) delete next[key]
  return next
}

function publicAttachment(attachment: PreparedAttachment): { name: string; size: number; mimeType: string; url: string } {
  const material = attachment.e2ee
  if (!material) {
    return {
      name: attachment.name,
      size: attachment.size,
      mimeType: attachment.mimeType,
      url: attachment.url,
    }
  }
  const keepMime = material.originalMime.startsWith('image/') || material.originalMime.startsWith('video/')
  return {
    name: 'encrypted',
    size: attachment.size,
    mimeType: keepMime ? material.originalMime : 'application/octet-stream',
    url: attachment.url,
  }
}

export async function rememberDecryptedMessage(messageId: string, threadId: string, payload: PlaintextPayload): Promise<void> {
  await vault.cachePlaintext(messageId, threadId, payload)
}

const presentInFlight = new Map<string, Promise<PresentableMessage>>()

type AttachmentUpdate = {
  messageId: string
  threadId: string
  attachments: PresentableMessage['attachments']
}
const attachmentListeners = new Set<(update: AttachmentUpdate) => void>()

export function subscribeAttachmentUpdates(listener: (update: AttachmentUpdate) => void): () => void {
  attachmentListeners.add(listener)
  return () => attachmentListeners.delete(listener)
}

function envelopeFingerprint(ciphertext: string): string {
  return `${ciphertext.length}:${ciphertext.slice(0, 24)}:${ciphertext.slice(-24)}`
}

function ownEnvelope(message: PresentableMessage, deviceId: number) {
  return (message.e2ee_envelopes || []).find((item) => Number(item.recipient_device_id) === deviceId)
}

export async function presentEncryptedMessage<T extends PresentableMessage>(message: T): Promise<T> {
  if (Number(message.e2ee_version) !== E2EE_VERSION) {
    return { ...message, e2ee_status: 'legacy' }
  }
  const existing = presentInFlight.get(message.id)
  if (existing) return existing as Promise<T>
  const task = withLock(() => presentLocked(message)).finally(() => {
    presentInFlight.delete(message.id)
  })
  presentInFlight.set(message.id, task)
  return task as Promise<T>
}

async function presentLocked<T extends PresentableMessage>(message: T): Promise<T> {
  try {
    const userId = await requireUserId()
    await openDevice(userId)
  } catch {
    return { ...message, e2ee_status: 'failed', e2ee_error: UNDECRYPTABLE_TEXT, content: '' }
  }
  const meta = vault.getMeta()
  const deviceId = Number(meta?.deviceId)
  const envelope = meta && Number.isInteger(deviceId) ? ownEnvelope(message, deviceId) : undefined
  const fingerprint = envelope ? envelopeFingerprint(envelope.ciphertext) : ''
  const clientSendId = readClientSendId(message.metadata)
  const cached =
    (await vault.readPlaintext(message.id)) ||
    (clientSendId ? await vault.readPlaintext(`send:${clientSendId}`) : null)
  const cacheMatches =
    cached &&
    (!fingerprint || !cached.fingerprint || cached.fingerprint === fingerprint)
  if (cached && cacheMatches) {
    if (cached.threadId) await vault.cachePlaintext(message.id, message.thread_id, cached.payload, fingerprint || cached.fingerprint)
    return applyPayload(message, cached.payload)
  }

  if (!envelope || !meta || !message.e2ee_sender_device_id) {
    const own = message.sender_id === meta?.userId
    return {
      ...message,
      content: '',
      e2ee_status: 'failed',
      e2ee_error: own ? UNAVAILABLE_ON_DEVICE_TEXT : UNDECRYPTABLE_TEXT,
    }
  }
  try {
    const json = await decryptFromDevice(
      vault.getSignalStore(),
      message.sender_id,
      message.e2ee_sender_device_id,
      { messageType: envelope.message_type === 3 ? 3 : 1, ciphertext: envelope.ciphertext }
    )
    vault.queuePersist()
    const payload = JSON.parse(json) as PlaintextPayload
    await vault.cachePlaintext(message.id, message.thread_id, payload, fingerprint)
    return applyPayload(message, payload)
  } catch {
    return { ...message, content: '', e2ee_status: 'failed', e2ee_error: UNDECRYPTABLE_TEXT }
  }
}

async function applyPayload<T extends PresentableMessage>(message: T, payload: PlaintextPayload): Promise<T> {
  const decrypted = {
    ...message,
    content: payload.text || '',
    e2ee_status: 'decrypted' as const,
    e2ee_error: undefined,
    attachments: message.attachments,
  }
  if (message.view_once || !message.attachments?.length || !(payload.attachments || []).length) {
    return decrypted
  }
  const ready = attachmentsAlreadyCached(message, payload)
  if (ready) {
    return { ...decrypted, attachments: await materializeAttachments(message, payload) }
  }
  void materializeAttachments(message, payload).then((attachments) => {
    if (!attachments) return
    const update = { messageId: message.id, threadId: message.thread_id, attachments }
    attachmentListeners.forEach((listener) => listener(update))
  })
  return {
    ...decrypted,
    attachments: message.attachments.map((attachment) => ({ ...attachment, url: '' })),
  }
}

function attachmentsAlreadyCached(message: PresentableMessage, payload: PlaintextPayload): boolean {
  const secrets = payload.attachments || []
  if (!message.attachments?.length || secrets.length === 0) return true
  return message.attachments.every((attachment) => {
    const secret =
      secrets.find((item) => item.url && attachment.url && item.url === attachment.url) ||
      (secrets.length === 1 ? secrets[0] : undefined)
    return !secret || blobUrls.has(`${message.id}:${secret.url}`)
  })
}

async function materializeAttachments<T extends PresentableMessage>(
  message: T,
  payload: PlaintextPayload
): Promise<PresentableMessage['attachments']> {
  const secrets = payload.attachments || []
  if (!message.attachments?.length) return message.attachments
  const next = []
  for (const attachment of message.attachments) {
    const secret =
      secrets.find((item) => item.url && attachment.url && item.url === attachment.url) ||
      (secrets.length === 1 ? secrets[0] : undefined)
    if (!secret) {
      next.push(attachment)
      continue
    }
    const cacheKey = `${message.id}:${secret.url}`
    let url = blobUrls.get(cacheKey)
    if (!url) {
      try {
        const bytes = await downloadCiphertext(secret.url)
        const plain = await decryptFileBytes(bytes, secret.key, secret.iv)
        url = URL.createObjectURL(new Blob([asArrayBuffer(plain)], { type: secret.mime || 'application/octet-stream' }))
        blobUrls.set(cacheKey, url)
      } catch {
        next.push({
          ...attachment,
          name: secret.name,
          mimeType: secret.mime,
          type: typeFromMime(secret.mime),
          url: '',
        })
        continue
      }
    }
    next.push({
      ...attachment,
      name: secret.name,
      mimeType: secret.mime,
      size: secret.size,
      type: typeFromMime(secret.mime),
      url,
    })
  }
  return next
}

async function downloadCiphertext(url: string): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('download failed')
  return new Uint8Array(await response.arrayBuffer())
}

function typeFromMime(mime: string): 'image' | 'video' | 'file' {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  return 'file'
}

function readClientSendId(metadata: Record<string, unknown> | undefined): string | undefined {
  const value = metadata?.__clientSendId
  return typeof value === 'string' && value.trim() ? value : undefined
}

export async function decryptViewOnceBlob(messageId: string, encrypted: Blob): Promise<Blob> {
  try {
    await ensureDevice()
  } catch {
    return encrypted
  }
  const cached = await vault.readPlaintext(messageId)
  const secrets = cached?.payload.attachments || []
  if (!cached || secrets.length === 0) return encrypted
  const bytes = new Uint8Array(await encrypted.arrayBuffer())
  for (const secret of secrets) {
    try {
      const plain = await decryptFileBytes(bytes, secret.key, secret.iv)
      return new Blob([asArrayBuffer(plain)], { type: secret.mime || 'application/octet-stream' })
    } catch {
      continue
    }
  }
  throw new Error('Unable to decrypt this attachment')
}

export async function searchCachedMessages(threadId: string, keyword: string): Promise<Array<{ id: string; payload: PlaintextPayload }>> {
  try {
    await ensureDevice()
    return await vault.searchPlaintext(threadId, keyword)
  } catch {
    return []
  }
}

export async function listOwnDevices(): Promise<DeviceDirectoryEntry[]> {
  await ensureDevice()
  const result = await apiClient.get<{ devices: DeviceDirectoryEntry[] }>('/api/e2ee/devices')
  return result.devices || []
}

export function currentDeviceId(): number | null {
  return vault.getMeta()?.deviceId ?? null
}

export async function revokeDevice(deviceId: number): Promise<void> {
  await apiClient.delete(`/api/e2ee/devices/${deviceId}`)
  const meta = vault.getMeta()
  if (meta?.deviceId === deviceId) {
    openUserId = null
    await vault.wipe()
  }
  clearEncryptionCache()
}

export async function revokeCurrentDeviceAndWipe(): Promise<void> {
  try {
    const meta = await ensureDevice()
    if (meta?.deviceId) {
      await apiClient.delete(`/api/e2ee/devices/${meta.deviceId}`).catch(() => undefined)
    }
  } catch {
    /* still wipe local keys */
  }
  openUserId = null
  pendingSends.clear()
  clearEncryptionCache()
  if (typeof indexedDB !== 'undefined') {
    await vault.wipe().catch(() => undefined)
  }
}

export async function revokeAllDevicesAndWipe(): Promise<void> {
  await apiClient.post('/api/e2ee/devices/revoke-all', {}).catch(() => undefined)
  openUserId = null
  pendingSends.clear()
  clearEncryptionCache()
  if (typeof indexedDB !== 'undefined') await vault.wipe().catch(() => undefined)
}

export async function createKeyBackup(passphrase: string): Promise<void> {
  await ensureDevice()
  await vault.flush()
  const encrypted = await encryptBackup(JSON.stringify(vault.exportPrivateState()), passphrase)
  await apiClient.put('/api/e2ee/backup', encrypted)
}

export async function restoreKeyBackup(passphrase: string): Promise<void> {
  const backup = await apiClient.get<EncryptedBackup | null>('/api/e2ee/backup')
  if (!backup?.ciphertext) throw new Error('No key backup found')
  const json = await decryptBackup(backup, passphrase)
  const state = JSON.parse(json) as { meta: VaultMeta; store: unknown }
  const userId = await requireUserId()
  if (state.meta.userId !== userId) throw new Error('This backup belongs to a different account')
  await vault.openForUser(userId)
  await vault.importPrivateState(state as { meta: VaultMeta; store: SerializedSignalStore })
  openUserId = userId
  const preKeys = await generatePreKeys(vault.getSignalStore(), state.meta.nextPreKeyId, PREKEY_BATCH)
  await apiClient.post('/api/e2ee/devices/restore', {
    device_id: state.meta.deviceId,
    device_name: state.meta.deviceName,
    registration_id: state.meta.registrationId,
    identity_key_public: arrayBufferToBase64((await vault.getSignalStore().getIdentityKeyPair())!.pubKey),
    signed_prekey: {
      key_id: state.meta.signedPreKeyId,
      public_key: state.meta.signedPreKeyPublic,
      signature: state.meta.signedPreKeySignature,
    },
    prekeys: preKeys.map((preKey) => ({ key_id: preKey.keyId, public_key: preKey.publicKey })),
  })
  vault.setMeta({ ...state.meta, nextPreKeyId: state.meta.nextPreKeyId + preKeys.length })
  await vault.flush()
  clearEncryptionCache()
}

export function isDeviceListChangedError(error: unknown): boolean {
  return error instanceof ApiError && (error.details as { code?: string } | undefined)?.code === 'E2EE_DEVICES_CHANGED'
}
