import type { SupabaseClient } from '@supabase/supabase-js'
import {
  SEALED_CALL_KEY_BYTES,
  X25519_KEY_BYTES,
  base64ToBytes,
  canonicalBase64,
} from './protocol'

export type CallDeviceRecord = {
  userId: string
  deviceId: string
  publicKey: string
}

export type SealedKeyInput = {
  recipientUserId: string
  recipientDeviceId: string
  sealedKey: string
}

const MAX_SEALS = 64

export function normalizeId(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function parseSealedKeyInputs(value: unknown): SealedKeyInput[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SEALS) return null
  const seals: SealedKeyInput[] = []
  const seen = new Set<string>()
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null
    const row = entry as Record<string, unknown>
    const recipientUserId = normalizeId(row.recipient_user_id ?? row.recipientUserId)
    const recipientDeviceId = normalizeId(row.recipient_device_id ?? row.recipientDeviceId)
    const sealedRaw = typeof row.sealed_key === 'string' ? row.sealed_key : typeof row.sealedKey === 'string' ? row.sealedKey : ''
    const sealedKey = canonicalBase64(sealedRaw)
    const packed = sealedKey ? base64ToBytes(sealedKey) : null
    if (!recipientUserId || !recipientDeviceId || !sealedKey || !packed) return null
    if (packed.length !== SEALED_CALL_KEY_BYTES || packed[0] !== 1) return null
    const dedupe = `${recipientUserId}:${recipientDeviceId}`
    if (seen.has(dedupe)) return null
    seen.add(dedupe)
    seals.push({ recipientUserId, recipientDeviceId, sealedKey })
  }
  return seals
}

export function canonicalPublicKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const canonical = canonicalBase64(value)
  if (!canonical) return null
  const bytes = base64ToBytes(canonical)
  if (!bytes || bytes.length !== X25519_KEY_BYTES) return null
  return canonical
}

export async function listThreadParticipantIds(
  service: SupabaseClient,
  threadId: string,
): Promise<string[]> {
  const { data, error } = await service
    .from('chat_participants')
    .select('user_id')
    .eq('thread_id', threadId)
  if (error) throw new Error(error.message)
  return [...new Set((data || []).map((row) => normalizeId(row.user_id)).filter(Boolean))]
}

export async function listActiveCallDevices(
  service: SupabaseClient,
  userIds: string[],
): Promise<CallDeviceRecord[]> {
  const ids = [...new Set(userIds.map((id) => id.trim().toLowerCase()).filter(Boolean))]
  if (ids.length === 0) return []
  const { data, error } = await service
    .from('user_devices')
    .select('user_id, device_id, public_key')
    .in('user_id', ids)
    .is('revoked_at', null)
  if (error) throw new Error(error.message)
  return (data || []).map((row) => ({
    userId: normalizeId(row.user_id),
    deviceId: normalizeId(row.device_id),
    publicKey: String(row.public_key),
  }))
}

export function usersMissingDevices(userIds: string[], devices: CallDeviceRecord[]): string[] {
  const present = new Set(devices.map((device) => device.userId))
  return userIds.filter((id) => !present.has(id))
}

/**
 * Every active device must have exactly one seal, and every seal must name an active device.
 * The server checks coverage only. It cannot decrypt the seals.
 */
export function assertSealsCoverDevices(seals: SealedKeyInput[], devices: CallDeviceRecord[]): void {
  if (devices.length === 0) {
    throw new Error('Encrypted calling is not set up for the people in this chat yet.')
  }
  const expected = new Map(devices.map((device) => [`${device.userId}:${device.deviceId}`, device]))
  if (seals.length !== expected.size) {
    throw new Error('Encrypted call key is missing for a participant device.')
  }
  for (const seal of seals) {
    if (!expected.has(`${seal.recipientUserId}:${seal.recipientDeviceId}`)) {
      throw new Error('Encrypted call key names a device that is not part of this call.')
    }
  }
}

export async function registerCallDevice(
  service: SupabaseClient,
  input: { userId: string; deviceId: string; publicKey: string; platform: 'web' | 'ios' | 'android' },
): Promise<void> {
  const userId = normalizeId(input.userId)
  const deviceId = normalizeId(input.deviceId)
  const publicKey = canonicalPublicKey(input.publicKey)
  if (!userId || deviceId.length < 8 || deviceId.length > 64 || !publicKey) {
    throw new Error('Invalid call device')
  }

  const { data: existing, error: readError } = await service
    .from('user_devices')
    .select('public_key, revoked_at')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle()
  if (readError) throw new Error(readError.message)

  if (!existing) {
    const { error } = await service.from('user_devices').insert({
      user_id: userId,
      device_id: deviceId,
      public_key: publicKey,
      platform: input.platform,
    })
    if (error) throw new Error(error.message)
    return
  }

  if (existing.revoked_at) {
    throw new Error('This device was revoked. Reset encrypted calling on this device.')
  }
  if (canonicalPublicKey(existing.public_key) !== publicKey) {
    throw new Error('This device is already registered with a different key.')
  }

  const { error } = await service
    .from('user_devices')
    .update({ last_seen_at: new Date().toISOString(), platform: input.platform })
    .eq('user_id', userId)
    .eq('device_id', deviceId)
  if (error) throw new Error(error.message)
}

async function senderOwnsDevice(
  service: SupabaseClient,
  senderUserId: string,
  senderDeviceId: string,
): Promise<boolean> {
  const { data, error } = await service
    .from('user_devices')
    .select('device_id')
    .eq('user_id', senderUserId)
    .eq('device_id', senderDeviceId)
    .is('revoked_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function storeInitialCallKeys(
  service: SupabaseClient,
  input: {
    threadId: string
    callSessionId: string
    callId: string
    senderUserId: string
    senderDeviceId: string
    seals: SealedKeyInput[]
  },
): Promise<void> {
  const senderUserId = normalizeId(input.senderUserId)
  const senderDeviceId = normalizeId(input.senderDeviceId)
  const participants = await listThreadParticipantIds(service, input.threadId)
  if (!participants.includes(senderUserId)) {
    throw new Error('Encrypted call key sender is not in this chat.')
  }
  if (!(await senderOwnsDevice(service, senderUserId, senderDeviceId))) {
    throw new Error('Encrypted call key sender device is not registered.')
  }

  const devices = await listActiveCallDevices(service, participants)
  const missing = usersMissingDevices(participants, devices)
  if (missing.length > 0) {
    throw new Error('Encrypted calling is not set up for every person in this chat yet.')
  }
  assertSealsCoverDevices(input.seals, devices)

  const { error } = await service.from('call_keys').insert(
    input.seals.map((seal) => ({
      call_session_id: input.callSessionId,
      call_id: input.callId,
      recipient_user_id: seal.recipientUserId,
      recipient_device_id: seal.recipientDeviceId,
      sender_user_id: senderUserId,
      sender_device_id: senderDeviceId,
      sealed_key: seal.sealedKey,
    })),
  )
  if (error) throw new Error(error.message)
}

export async function storeInviteeCallKeys(
  service: SupabaseClient,
  input: {
    callId: string
    senderUserId: string
    senderDeviceId: string
    targetUserId: string
    seals: SealedKeyInput[]
  },
): Promise<void> {
  const senderUserId = normalizeId(input.senderUserId)
  const senderDeviceId = normalizeId(input.senderDeviceId)
  const targetUserId = normalizeId(input.targetUserId)
  if (!(await senderOwnsDevice(service, senderUserId, senderDeviceId))) {
    throw new Error('Encrypted call key sender device is not registered.')
  }

  const { data: sessions, error: sessionError } = await service
    .from('call_sessions')
    .select('id, created_by, participants, metadata, status, created_at')
    .eq('call_id', input.callId)
    .in('status', ['initiated', 'ringing', 'active'])
    .order('created_at', { ascending: true })
  if (sessionError) throw new Error(sessionError.message)

  const primary = (sessions || []).find((row) => isMetadataE2ee(row.metadata))
  if (!primary) throw new Error('This call is not encrypted.')

  const participants = Array.isArray(primary.participants) ? primary.participants.map(normalizeId) : []
  const senderAllowed = normalizeId(primary.created_by) === senderUserId || participants.includes(senderUserId)
  if (!senderAllowed) throw new Error('Only call participants can seal keys for new people.')

  const devices = (await listActiveCallDevices(service, [targetUserId])).filter(
    (device) => device.userId === targetUserId,
  )
  if (devices.length === 0) {
    throw new Error('This person has not set up encrypted calling on a device yet.')
  }
  assertSealsCoverDevices(input.seals, devices)

  const rows = input.seals.map((seal) => ({
    call_session_id: primary.id as string,
    call_id: input.callId,
    recipient_user_id: seal.recipientUserId,
    recipient_device_id: seal.recipientDeviceId,
    sender_user_id: senderUserId,
    sender_device_id: senderDeviceId,
    sealed_key: seal.sealedKey,
  }))

  const { error } = await service.from('call_keys').upsert(rows, {
    onConflict: 'call_id,recipient_user_id,recipient_device_id',
    ignoreDuplicates: true,
  })
  if (error) throw new Error(error.message)
}

function isMetadataE2ee(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
  return (metadata as Record<string, unknown>).e2ee === true
}

export async function readOwnSealedCallKey(
  service: SupabaseClient,
  input: { userId: string; callId: string; deviceId: string },
): Promise<{ sealedKey: string; senderDeviceId: string; senderUserId: string; senderPublicKey: string } | null> {
  const userId = normalizeId(input.userId)
  const deviceId = normalizeId(input.deviceId)
  const { data: owned, error: ownedError } = await service
    .from('user_devices')
    .select('device_id')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle()
  if (ownedError) throw new Error(ownedError.message)
  if (!owned) return null

  const { data: key, error } = await service
    .from('call_keys')
    .select('sealed_key, sender_device_id, sender_user_id')
    .eq('call_id', input.callId)
    .eq('recipient_user_id', userId)
    .eq('recipient_device_id', deviceId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!key) return null

  const { data: sender, error: senderError } = await service
    .from('user_devices')
    .select('public_key')
    .eq('user_id', key.sender_user_id)
    .eq('device_id', key.sender_device_id)
    .maybeSingle()
  if (senderError) throw new Error(senderError.message)
  if (!sender?.public_key) return null

  return {
    sealedKey: String(key.sealed_key),
    senderDeviceId: normalizeId(key.sender_device_id),
    senderUserId: normalizeId(key.sender_user_id),
    senderPublicKey: String(sender.public_key),
  }
}

export async function recipientHasSealedKey(
  service: SupabaseClient,
  input: { userId: string; callId: string; deviceId: string },
): Promise<boolean> {
  const { data, error } = await service
    .from('call_keys')
    .select('id')
    .eq('call_id', input.callId)
    .eq('recipient_user_id', normalizeId(input.userId))
    .eq('recipient_device_id', normalizeId(input.deviceId))
    .limit(1)
  if (error) throw new Error(error.message)
  return Array.isArray(data) && data.length > 0
}
