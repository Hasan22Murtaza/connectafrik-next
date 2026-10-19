'use client'

import { apiClient } from '@/lib/api-client'
import type { ChatAttachment, ChatMessage } from '@/features/chat/services/supabaseMessagingService'
import { openCla1 } from '@/lib/message-e2ee/cla1'
import { linkPayload, matrixRoomId, matrixUserId, normalizeLinkInput } from '@/lib/message-e2ee/ids'
import { messageE2eeActive } from '@/lib/message-e2ee/status'
import { safetyNumberDigits } from '@/lib/message-e2ee/safety'

type Wasm = typeof import('@matrix-org/matrix-sdk-crypto-wasm')
type Machine = import('@matrix-org/matrix-sdk-crypto-wasm').OlmMachine

const LOCKED = "🔒 This message can't be read on this device"
const ROTATION_MICROS = BigInt(7) * BigInt(24) * BigInt(60) * BigInt(60) * BigInt(1000000)

export type EncryptResult =
  | { mode: 'off' }
  | { mode: 'fallback'; reason: string }
  | {
      mode: 'megolm'
      ciphertext: string
      sessionId: string
      senderDeviceId: string
    }

type WireRequest = {
  id?: string
  type?: number
  body?: string
  event_type?: string
  free?: () => void
}

type SyncEvent = { id: string; type: string; sender: string; content: unknown }

let wasmPromise: Promise<Wasm> | null = null
let machine: Machine | null = null
let activeUserId: string | null = null
let activeDeviceId: string | null = null
let ownsIdentity = false
let queue: Promise<unknown> = Promise.resolve()
let pollTimer: number | null = null
const keyListeners = new Set<() => void>()
const decryptCache = new Map<string, ChatMessage>()

/** Public URL so Turbopack/webpack do not need special .wasm asset rules. */
const PUBLIC_WASM_PATH = '/matrix_sdk_crypto_wasm_bg.wasm'

/**
 * Resolve a URL that WebAssembly.instantiateStreaming will accept.
 * Some reverse proxies serve .wasm as octet-stream; re-wrap as a blob when needed.
 */
async function resolveWasmUrl(): Promise<string | URL> {
  const res = await fetch(PUBLIC_WASM_PATH)
  if (!res.ok) {
    throw new Error(
      `Encryption module missing (${res.status}). Redeploy after npm install so public/matrix_sdk_crypto_wasm_bg.wasm exists.`,
    )
  }
  const type = (res.headers.get('content-type') || '').toLowerCase()
  if (type.includes('application/wasm') || type.includes('application/octet-stream')) {
    if (type.includes('application/wasm')) return PUBLIC_WASM_PATH
    const buffer = await res.arrayBuffer()
    return URL.createObjectURL(new Blob([buffer], { type: 'application/wasm' }))
  }
  // HTML error pages / wrong MIME — blob wrap still lets instantiateStreaming run.
  const buffer = await res.arrayBuffer()
  if (buffer.byteLength < 1000) {
    throw new Error('Encryption module failed to download. Check that the site is served over HTTPS.')
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'application/wasm' }))
}

async function loadWasm(): Promise<Wasm> {
  if (!wasmPromise) {
    wasmPromise = (async () => {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        throw new Error(
          'End-to-end encryption needs a secure context (HTTPS or localhost). Open this site over HTTPS.',
        )
      }
      const mod = await import('@matrix-org/matrix-sdk-crypto-wasm')
      const url = await resolveWasmUrl()
      try {
        await mod.initAsync(url)
      } finally {
        // Blob URLs are only used when the proxy MIME type is wrong.
        if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url)
      }
      return mod
    })().catch((error) => {
      wasmPromise = null
      throw error
    })
  }
  return wasmPromise
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

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

function deviceCredentials(userId: string): { deviceId: string; passphrase: string } {
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

function memberKey(threadId: string) {
  return `cribstalk.megolm.members.${threadId}`
}

function writeOwnsIdentity(userId: string, owns: boolean) {
  ownsIdentity = owns
  localStorage.setItem(storageKey(userId, 'owns-identity'), owns ? 'yes' : 'no')
}

async function postRequest(deviceId: string, request: WireRequest, eventType?: string) {
  return apiClient.post<Record<string, unknown>>('/api/message-e2ee/request', {
    id: request.id,
    type: request.type,
    body: request.body,
    deviceId,
    ...(eventType ? { eventType } : {}),
  })
}

async function sendAndMark(mod: Wasm, current: Machine, deviceId: string, request: WireRequest) {
  if (!request.id || request.type == null || !request.body) return { existing: false, serverHasIdentity: false }
  const response = await postRequest(deviceId, request, request.event_type)
  await current.markRequestAsSent(request.id, request.type, JSON.stringify(response ?? {}))
  const masterKeys = response?.master_keys
  const serverHasIdentity = Boolean(
    masterKeys && typeof masterKeys === 'object' && Object.keys(masterKeys as object).length > 0,
  )
  return { existing: response?.existing === true, serverHasIdentity }
}

async function flush(mod: Wasm, current: Machine, deviceId: string, depth = 0): Promise<boolean> {
  if (depth > 5) return false
  const requests = (await current.outgoingRequests()) as WireRequest[]
  if (!requests?.length) return false
  let serverHasIdentity = false
  for (const request of requests) {
    try {
      if (request.type === 5 || request.type === 6) {
        if (request.id && request.type != null) {
          await current.markRequestAsSent(request.id, request.type, '{}')
        }
      } else {
        const result = await sendAndMark(mod, current, deviceId, request)
        if (result.serverHasIdentity) serverHasIdentity = true
      }
    } catch (error) {
      console.warn('[message-e2ee] key request failed', {
        type: request.type,
        reason: error instanceof Error ? error.name : 'error',
      })
    } finally {
      request.free?.()
    }
  }
  const nested = await flush(mod, current, deviceId, depth + 1)
  return serverHasIdentity || nested
}

async function pull(mod: Wasm, current: Machine, userId: string, deviceId: string) {
  const sync = await apiClient.get<{
    events?: SyncEvent[]
    oneTimeKeyCount?: number
    unusedFallback?: string[]
  }>('/api/message-e2ee/sync', { device_id: deviceId })
  const events = Array.isArray(sync?.events) ? sync.events : []
  const lists = new mod.DeviceLists()
  const counts = new Map<string, number>([['signed_curve25519', sync?.oneTimeKeyCount ?? 0]])
  const unused = new Set(sync?.unusedFallback || [])
  let processed: Array<{ rawEvent?: string; type?: number; free?: () => void }> = []
  try {
    processed = (await current.receiveSyncChanges(
      JSON.stringify(events.map(({ type, sender, content }) => ({ type, sender, content }))),
      lists,
      counts,
      unused,
    )) as Array<{ rawEvent?: string; type?: number; free?: () => void }>
  } finally {
    lists.free()
  }
  // Never ack UnableToDecrypt to-device events — those are room keys / link
  // bundles we still need. Deleting them left web clients permanently locked.
  const ackIds: string[] = []
  for (let i = 0; i < events.length; i++) {
    const id = events[i]?.id
    if (!id) continue
    const result = processed[i]
    if (!result || result.type === mod.ProcessedToDeviceEventType.UnableToDecrypt) {
      if (result?.type === mod.ProcessedToDeviceEventType.UnableToDecrypt) {
        console.warn('[message-e2ee] to-device event still locked; leaving queued', { id })
      }
      continue
    }
    ackIds.push(id)
  }
  if (ackIds.length > 0) {
    await apiClient.post('/api/message-e2ee/sync/ack', { ids: ackIds }).catch(() => undefined)
  }
  let gotKeys = false
  for (const event of processed) {
    try {
      if (event.type === mod.ProcessedToDeviceEventType.UnableToDecrypt) continue
      if (!event.rawEvent) continue
      const raw = JSON.parse(event.rawEvent) as { type?: string; content?: { v?: number; bundle?: unknown } }
      if (raw.type === 'cribstalk.link' && raw.content?.bundle) {
        const bundle = mod.SecretsBundle.from_json(raw.content.bundle)
        await current.importSecretsBundle(bundle)
        writeOwnsIdentity(userId, true)
        await signCurrentDevice(mod, current, deviceId)
        gotKeys = true
      }
      if (raw.type === 'm.room_key' || raw.type === 'm.forwarded_room_key') {
        gotKeys = true
      }
    } catch (error) {
      console.warn('[message-e2ee] to-device event failed', {
        reason: error instanceof Error ? error.message || error.name : 'error',
      })
    } finally {
      event.free?.()
    }
  }
  if (gotKeys || processed.some((event) => event.type === mod.ProcessedToDeviceEventType.Decrypted)) {
    keyListeners.forEach((listener) => listener())
  }
}

async function signCurrentDevice(mod: Wasm, current: Machine, deviceId: string) {
  const status = await current.crossSigningStatus()
  if (!status.hasMaster || !status.hasSelfSigning) return
  const boot = await current.bootstrapCrossSigning(false)
  try {
    if (boot.uploadKeysRequest) {
      await sendAndMark(mod, current, deviceId, boot.uploadKeysRequest as WireRequest)
    }
    const signingBody = boot.uploadSigningKeysRequest?.body
    if (typeof signingBody === 'string') {
      await apiClient.post('/api/message-e2ee/request', {
        type: 'signing-keys',
        body: signingBody,
        deviceId,
      })
    }
    if (boot.uploadSignaturesRequest) {
      await sendAndMark(mod, current, deviceId, boot.uploadSignaturesRequest as WireRequest)
    }
  } finally {
    boot.free?.()
  }
}

async function bootstrapIdentity(mod: Wasm, current: Machine, userId: string, deviceId: string) {
  const serverHasIdentity = await flush(mod, current, deviceId)
  const me = new mod.UserId(matrixUserId(userId))
  try {
    await current.updateTrackedUsers([me])
  } catch {
    me.free()
  }
  const queried = await flush(mod, current, deviceId)
  const status = await current.crossSigningStatus()
  if (status.hasMaster && status.hasSelfSigning && status.hasUserSigning) {
    if (localStorage.getItem(storageKey(userId, 'owns-identity')) !== 'no') {
      writeOwnsIdentity(userId, true)
    } else {
      ownsIdentity = false
    }
    return
  }
  const identityUser = new mod.UserId(matrixUserId(userId))
  const identity = await current.getIdentity(identityUser)
  identityUser.free()
  const serverIdentity = Boolean(identity) || serverHasIdentity || queried
  identity?.free?.()
  if (serverIdentity) {
    writeOwnsIdentity(userId, false)
    return
  }
  const boot = await current.bootstrapCrossSigning(true)
  try {
    if (boot.uploadKeysRequest) {
      await sendAndMark(mod, current, deviceId, boot.uploadKeysRequest as WireRequest)
    }
    const signingBody = boot.uploadSigningKeysRequest?.body
    if (typeof signingBody === 'string') {
      const result = await apiClient.post<{ existing?: boolean }>('/api/message-e2ee/request', {
        type: 'signing-keys',
        body: signingBody,
        deviceId,
      })
      if (result?.existing) {
        writeOwnsIdentity(userId, false)
        return
      }
    }
    if (boot.uploadSignaturesRequest) {
      await sendAndMark(mod, current, deviceId, boot.uploadSignaturesRequest as WireRequest)
    }
    writeOwnsIdentity(userId, true)
  } finally {
    boot.free?.()
  }
  await flush(mod, current, deviceId)
}

async function openMachine(userId: string): Promise<{ mod: Wasm; current: Machine; deviceId: string }> {
  if (machine && activeUserId === userId && activeDeviceId) {
    return { mod: await loadWasm(), current: machine, deviceId: activeDeviceId }
  }
  if (machine) {
    machine.close()
    machine = null
  }
  const mod = await loadWasm()
  const { deviceId, passphrase } = deviceCredentials(userId)
  const user = new mod.UserId(matrixUserId(userId))
  const device = new mod.DeviceId(deviceId)
  const current = await mod.OlmMachine.initialize(
    user,
    device,
    `cribstalk-message-e2ee:${userId}:${deviceId}`,
    passphrase,
  )
  user.free()
  device.free()
  machine = current
  activeUserId = userId
  activeDeviceId = deviceId
  try {
    current.registerRoomKeyUpdatedCallback(async () => {
      keyListeners.forEach((listener) => listener())
    })
  } catch {
    // Older wasm builds may omit the callback; poll + decrypt still run.
  }
  await bootstrapIdentity(mod, current, userId, deviceId)
  if (pollTimer == null) {
    pollTimer = window.setInterval(() => {
      void enqueue(async () => {
        if (!machine || !activeUserId || !activeDeviceId) return
        const loaded = await loadWasm()
        await pull(loaded, machine, activeUserId, activeDeviceId)
        await flush(loaded, machine, activeDeviceId)
      }).catch(() => undefined)
    }, 4000)
  }
  return { mod, current, deviceId }
}

async function withMachine<T>(userId: string, task: (ctx: { mod: Wasm; current: Machine; deviceId: string }) => Promise<T>) {
  return enqueue(async () => {
    const ctx = await openMachine(userId)
    await pull(ctx.mod, ctx.current, userId, ctx.deviceId)
    await flush(ctx.mod, ctx.current, ctx.deviceId)
    return task(ctx)
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

async function shareSession(
  mod: Wasm,
  current: Machine,
  deviceId: string,
  threadId: string,
  userIds: string[],
  rotate: boolean,
) {
  const room = new mod.RoomId(matrixRoomId(threadId))
  try {
    if (rotate) await current.invalidateGroupSession(room)
    const tracked = userIds.map((id) => new mod.UserId(matrixUserId(id)))
    try {
      await current.updateTrackedUsers(tracked)
    } catch {
      tracked.forEach((id) => id.free())
    }
    await flush(mod, current, deviceId)
    const missingUsers = userIds.map((id) => new mod.UserId(matrixUserId(id)))
    const claim = await current.getMissingSessions(missingUsers)
    if (claim) {
      await sendAndMark(mod, current, deviceId, claim as WireRequest)
      claim.free?.()
    }
    await flush(mod, current, deviceId)
    const settings = new mod.EncryptionSettings()
    settings.algorithm = mod.EncryptionAlgorithm.MegolmV1AesSha2
    settings.historyVisibility = mod.HistoryVisibility.Joined
    settings.rotationPeriodMessages = BigInt(100)
    settings.rotationPeriod = ROTATION_MICROS
    // Share to every published device (web↔web and phone). Cross-signing is
    // still used for safety numbers; requiring signed devices here left web
    // recipients with locked messages when signatures lagged.
    settings.sharingStrategy = mod.CollectStrategy.allDevices()
    const shareUsers = userIds.map((id) => new mod.UserId(matrixUserId(id)))
    try {
      const requests = await current.shareRoomKey(room, shareUsers, settings)
      for (const request of requests as WireRequest[]) {
        await sendAndMark(mod, current, deviceId, request)
        request.free?.()
      }
    } finally {
      settings.free()
    }
  } finally {
    room.free()
  }
}

function msgtypeFor(messageType: string | undefined, attachments: ChatAttachment[]): string {
  if (attachments.some((item) => item.type === 'image' || item.mimeType.startsWith('image/'))) return 'm.image'
  if (attachments.some((item) => item.type === 'video' || item.mimeType.startsWith('video/'))) return 'm.video'
  if (attachments.some((item) => item.mimeType.startsWith('audio/'))) return 'm.audio'
  if (attachments.length > 0) return 'm.file'
  if (messageType === 'image') return 'm.image'
  if (messageType === 'video') return 'm.video'
  if (messageType === 'audio') return 'm.audio'
  return 'm.text'
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
    return await withMachine(input.userId, async ({ mod, current, deviceId }) => {
      const ids = await participantIds(input.threadId, input.userId)
      const shrunk = rememberMembers(input.threadId, ids)
      await shareSession(mod, current, deviceId, input.threadId, ids, shrunk)
      const room = new mod.RoomId(matrixRoomId(input.threadId))
      try {
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
        const encrypted = JSON.parse(await current.encryptRoomEvent(room, 'm.room.message', plaintext)) as {
          session_id?: string
          device_id?: string
        }
        if (!encrypted.session_id) throw new Error('session')
        return {
          mode: 'megolm' as const,
          ciphertext: JSON.stringify(encrypted),
          sessionId: encrypted.session_id,
          senderDeviceId: encrypted.device_id || deviceId,
        }
      } finally {
        room.free()
      }
    })
  } catch (error) {
    if (sealed.length > 0) {
      throw new Error('Attachment was uploaded as ciphertext and could not be sealed into the message')
    }
    console.warn('[message-e2ee] megolm send failed', {
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
  const blob = await openCla1(sealed, key, sha256)
  return URL.createObjectURL(new Blob([blob], { type: mime || 'application/octet-stream' }))
}

export async function decryptStoredMessage(message: ChatMessage): Promise<ChatMessage> {
  if (message.e2ee_version !== 2 || !message.ciphertext) return message
  const cached = decryptCache.get(message.id)
  if (cached && cached.ciphertext === message.ciphertext) return { ...message, ...cached, sender: message.sender }
  if (!(await messageE2eeActive())) {
    return { ...message, content: LOCKED, e2ee_locked: true, attachments: [] }
  }
  try {
    const content = JSON.parse(message.ciphertext) as { session_id?: string }
    const opened = await withMachine(await accountUserId(), async ({ mod, current }) => {
      const room = new mod.RoomId(matrixRoomId(message.thread_id))
      const settings = new mod.DecryptionSettings(mod.TrustRequirement.Untrusted)
      try {
        const event = JSON.stringify({
          type: 'm.room.encrypted',
          sender: matrixUserId(message.sender_id),
          event_id: `$${message.id.replace(/-/g, '')}`,
          origin_server_ts: Date.parse(message.created_at) || Date.now(),
          content,
        })
        const decrypted = await current.decryptRoomEvent(event, room, settings)
        try {
          return JSON.parse(decrypted.event) as { content?: { body?: string; attachments?: Array<Record<string, unknown>> } }
        } finally {
          decrypted.free()
        }
      } finally {
        room.free()
        settings.free()
      }
    })
    const plain = opened.content || {}
    const sealedAttachments = Array.isArray(plain.attachments) ? plain.attachments : []
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
      content: typeof plain.body === 'string' ? plain.body : '',
      attachments: attachments.length > 0 ? attachments : message.attachments,
      e2ee_locked: false,
    }
    decryptCache.set(message.id, next)
    return next
  } catch (error) {
    console.warn('[message-e2ee] decrypt failed', {
      messageId: message.id,
      reason: error instanceof Error ? error.message || error.name : 'error',
    })
    return { ...message, content: LOCKED, e2ee_locked: true, attachments: [] }
  }
}

async function accountUserId(): Promise<string> {
  if (activeUserId) return activeUserId
  const { data } = await (await import('@/lib/supabase')).supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) throw new Error('signed-out')
  return userId
}

export async function rotateThreadSession(threadId: string, userId: string): Promise<void> {
  if (!(await messageE2eeActive())) return
  await enqueue(async () => {
    const { mod, current } = await openMachine(userId)
    const room = new mod.RoomId(matrixRoomId(threadId))
    try {
      await current.invalidateGroupSession(room)
    } finally {
      room.free()
    }
    sessionStorage.removeItem(memberKey(threadId))
  }).catch((error) => {
    console.warn('[message-e2ee] session rotation failed', {
      threadId,
      reason: error instanceof Error ? error.name : 'error',
    })
  })
}

export function onMessageKeys(listener: () => void): () => void {
  keyListeners.add(listener)
  return () => keyListeners.delete(listener)
}

export async function encryptionDeviceStatus(userId: string): Promise<{ deviceId: string; ownsIdentity: boolean; payload: string }> {
  if (!(await messageE2eeActive())) throw new Error('off')
  return withMachine(userId, async ({ deviceId }) => ({
    deviceId,
    ownsIdentity,
    payload: linkPayload(userId, deviceId),
  }))
}

/** updateTrackedUsers / getMissingSessions / shareRoomKey take ownership of UserIds. */
function releaseUserId(id: { free?: () => void } | null | undefined) {
  try {
    id?.free?.()
  } catch {
    // Already consumed by WASM.
  }
}

export async function linkDeviceFromPayload(userId: string, payload: string): Promise<void> {
  const parsed = normalizeLinkInput(payload, userId)
  if (!parsed) {
    throw new Error('That is not a valid device code. Paste the full code or the other browser’s device id.')
  }
  if (parsed.userId !== userId) throw new Error('This QR code is for a different account')
  if (!ownsIdentity) throw new Error('This device does not hold the account encryption keys')
  try {
    await withMachine(userId, async ({ mod, current, deviceId }) => {
      if (parsed.deviceId === deviceId) {
        throw new Error('That code is for this browser. Paste the other browser’s code instead.')
      }
      await current.markAllTrackedUsersAsDirty()
      await flush(mod, current, deviceId)
      // Query keys again so a browser that just opened Link a device is visible.
      // updateTrackedUsers invalidates its UserId args — do not free after success.
      const tracked = new mod.UserId(matrixUserId(userId))
      try {
        await current.updateTrackedUsers([tracked])
      } catch {
        releaseUserId(tracked)
      }
      await flush(mod, current, deviceId)
      const owner = new mod.UserId(matrixUserId(userId))
      const target = new mod.DeviceId(parsed.deviceId)
      let device = await current.getDevice(owner, target, 0)
      if (!device) {
        await current.markAllTrackedUsersAsDirty()
        await flush(mod, current, deviceId)
        device = await current.getDevice(owner, target, 0)
      }
      if (!device) {
        owner.free()
        target.free()
        throw new Error(
          'That browser has not published encryption keys yet. Open Link a device on it, wait a few seconds, then try again.',
        )
      }
      // getMissingSessions also invalidates UserIds.
      const missing = await current.getMissingSessions([new mod.UserId(matrixUserId(userId))])
      if (missing) {
        await sendAndMark(mod, current, deviceId, missing as WireRequest)
        missing.free?.()
      }
      await flush(mod, current, deviceId)
      // Prefer a fresh Device handle after the Olm session is established.
      device.free()
      device = await current.getDevice(owner, target, 0)
      owner.free()
      if (!device) {
        target.free()
        throw new Error('Could not reach that device after creating a secure channel. Try again.')
      }
      const bundle = await current.exportSecretsBundle()
      try {
        const encrypted = await device.encryptToDeviceEvent(
          'cribstalk.link',
          { v: 1, bundle: bundle.to_json() },
          mod.CollectStrategy.allDevices(),
        )
        await apiClient.post('/api/message-e2ee/request', {
          type: 3,
          eventType: 'm.room.encrypted',
          deviceId,
          body: JSON.stringify({
            messages: {
              [matrixUserId(userId)]: {
                [parsed.deviceId]: JSON.parse(encrypted),
              },
            },
          }),
        })
      } finally {
        bundle.free?.()
        device.free()
        target.free()
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/null pointer|out of bounds|moved value/i.test(message)) {
      throw new Error('Linking hit a crypto error on this browser. Refresh both windows and try pasting the other device id again.')
    }
    throw error
  }
}

export async function safetyNumberForUser(userId: string, otherUserId: string): Promise<string> {
  if (!(await messageE2eeActive())) throw new Error('off')
  return withMachine(userId, async ({ mod, current, deviceId }) => {
    const ids = [userId, otherUserId].map((id) => new mod.UserId(matrixUserId(id)))
    try {
      await current.updateTrackedUsers(ids)
    } catch {
      ids.forEach((id) => id.free())
    }
    await flush(mod, current, deviceId)
    const localUser = new mod.UserId(matrixUserId(userId))
    const remoteUser = new mod.UserId(matrixUserId(otherUserId))
    try {
      const local = await current.getIdentity(localUser)
      const remote = await current.getIdentity(remoteUser)
      try {
        if (!local?.masterKey || !remote?.masterKey) {
          throw new Error('That person has not set up encryption on a device yet')
        }
        return await safetyNumberDigits(local.masterKey, remote.masterKey)
      } finally {
        local?.free?.()
        remote?.free?.()
      }
    } finally {
      localUser.free()
      remoteUser.free()
    }
  })
}
