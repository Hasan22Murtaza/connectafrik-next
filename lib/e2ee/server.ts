import type { SupabaseClient } from '@supabase/supabase-js'
import { GROUP_MEMBER_JOINED, GROUP_MEMBER_LEFT } from '@/lib/groupChatSystemMessages'
import { MARKETPLACE_SYSTEM } from '@/lib/chat/marketplaceChat'
import { isSignalPublicKey, isSignalSignature } from './bytes'
import { E2EE_THREAD_PREVIEW, E2EE_VERSION } from './types'

const CALL_AND_SYSTEM_TYPES = new Set<string>([
  'initiated',
  'ringing',
  'active',
  'declined',
  'ended',
  'missed',
  'failed',
  'accepted_on_another_device',
  GROUP_MEMBER_JOINED,
  GROUP_MEMBER_LEFT,
  MARKETPLACE_SYSTEM,
])

const SENSITIVE_METADATA_KEYS = ['previewText', 'caption', 'plaintext', 'body', 'text', 'note']

export interface EnvelopeRowInput {
  recipient_user_id: string
  recipient_device_id: number
  message_type: number
  ciphertext: string
}

export class E2eeRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message)
    this.name = 'E2eeRequestError'
  }
}

export function messageTypeUsesE2ee(messageType: string | undefined): boolean {
  return !CALL_AND_SYSTEM_TYPES.has(messageType || 'text')
}

export function parseEnvelopeList(value: unknown): EnvelopeRowInput[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const row = item as Record<string, unknown>
    const recipientUserId = typeof row.recipient_user_id === 'string' ? row.recipient_user_id : ''
    const deviceId = Number(row.recipient_device_id)
    const messageType = Number(row.message_type)
    const ciphertext = typeof row.ciphertext === 'string' ? row.ciphertext : ''
    if (!recipientUserId || !Number.isInteger(deviceId) || deviceId < 1) {
      throw new E2eeRequestError('Invalid encryption envelope', 400, 'E2EE_INVALID')
    }
    if (messageType !== 1 && messageType !== 3) {
      throw new E2eeRequestError('Invalid Signal message type', 400, 'E2EE_INVALID')
    }
    if (!ciphertext || ciphertext.length > 500_000) {
      throw new E2eeRequestError('Invalid ciphertext', 400, 'E2EE_INVALID')
    }
    return {
      recipient_user_id: recipientUserId,
      recipient_device_id: deviceId,
      message_type: messageType,
      ciphertext,
    }
  })
}

export function stripSensitiveMetadata(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!metadata) return null
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_METADATA_KEYS.includes(key)) continue
    next[key] = value
  }
  return next
}

export function assertPublicKeyMaterial(input: {
  identityKey: string
  signedPublic: string
  signature: string
  preKeys: string[]
}): void {
  if (!isSignalPublicKey(input.identityKey) || !isSignalPublicKey(input.signedPublic)) {
    throw new E2eeRequestError('Invalid public key', 400, 'E2EE_INVALID')
  }
  if (!isSignalSignature(input.signature)) {
    throw new E2eeRequestError('Invalid signed prekey signature', 400, 'E2EE_INVALID')
  }
  for (const key of input.preKeys) {
    if (!isSignalPublicKey(key)) {
      throw new E2eeRequestError('Invalid one-time prekey', 400, 'E2EE_INVALID')
    }
  }
}

export async function listActiveParticipantIds(
  serviceClient: SupabaseClient,
  threadId: string
): Promise<string[]> {
  const { data, error } = await serviceClient
    .from('chat_participants')
    .select('user_id')
    .eq('thread_id', threadId)
  if (error) throw new E2eeRequestError(error.message, 400, 'E2EE_INVALID')
  return [...new Set((data || []).map((row: { user_id: string }) => row.user_id).filter(Boolean))]
}

export async function threadRequiresE2ee(
  serviceClient: SupabaseClient,
  threadId: string
): Promise<boolean> {
  const participantIds = await listActiveParticipantIds(serviceClient, threadId)
  if (participantIds.length === 0) return false
  const { data, error } = await serviceClient
    .from('user_devices')
    .select('user_id')
    .in('user_id', participantIds)
    .is('revoked_at', null)
  if (error) {
    if (isMissingE2eeSchema(error)) return false
    throw new E2eeRequestError(error.message, 400, 'E2EE_INVALID')
  }
  const ready = new Set((data || []).map((row: { user_id: string }) => row.user_id))
  return participantIds.every((id) => ready.has(id))
}

export async function assertEnvelopesMatchDevices(
  serviceClient: SupabaseClient,
  threadId: string,
  senderUserId: string,
  senderDeviceId: number,
  envelopes: EnvelopeRowInput[]
): Promise<void> {
  const [senderResult, participantIds] = await Promise.all([
    serviceClient
      .from('user_devices')
      .select('device_id')
      .eq('user_id', senderUserId)
      .eq('device_id', senderDeviceId)
      .is('revoked_at', null)
      .maybeSingle(),
    listActiveParticipantIds(serviceClient, threadId),
  ])
  if (senderResult.error) throw new E2eeRequestError(senderResult.error.message, 400, 'E2EE_INVALID')
  if (!senderResult.data) {
    throw new E2eeRequestError('Unknown sending device', 403, 'E2EE_DEVICE')
  }
  const { data: devices, error } = await serviceClient
    .from('user_devices')
    .select('user_id, device_id')
    .in('user_id', participantIds)
    .is('revoked_at', null)
  if (error) throw new E2eeRequestError(error.message, 400, 'E2EE_INVALID')

  const required = new Set<string>()
  for (const device of devices || []) {
    if (device.user_id === senderUserId && device.device_id === senderDeviceId) continue
    required.add(`${device.user_id}:${device.device_id}`)
  }
  const provided = new Set(envelopes.map((envelope) => `${envelope.recipient_user_id}:${envelope.recipient_device_id}`))
  for (const key of required) {
    if (!provided.has(key)) {
      throw new E2eeRequestError('Encryption devices are out of date', 409, 'E2EE_DEVICES_CHANGED')
    }
  }
  for (const envelope of envelopes) {
    const key = `${envelope.recipient_user_id}:${envelope.recipient_device_id}`
    if (!required.has(key)) {
      throw new E2eeRequestError('Envelope addressed to an unknown device', 400, 'E2EE_INVALID')
    }
  }
}

export async function insertEnvelopes(
  serviceClient: SupabaseClient,
  messageId: string,
  envelopes: EnvelopeRowInput[]
): Promise<void> {
  if (envelopes.length === 0) return
  const { error } = await serviceClient.from('e2ee_envelopes').insert(
    envelopes.map((envelope) => ({
      message_id: messageId,
      recipient_user_id: envelope.recipient_user_id,
      recipient_device_id: envelope.recipient_device_id,
      message_type: envelope.message_type,
      ciphertext: envelope.ciphertext,
    }))
  )
  if (error) throw new E2eeRequestError(error.message, 400, 'E2EE_INVALID')
}

export async function replaceEnvelopes(
  serviceClient: SupabaseClient,
  messageId: string,
  envelopes: EnvelopeRowInput[]
): Promise<void> {
  const { error } = await serviceClient.from('e2ee_envelopes').delete().eq('message_id', messageId)
  if (error) throw new E2eeRequestError(error.message, 400, 'E2EE_INVALID')
  await insertEnvelopes(serviceClient, messageId, envelopes)
}

export async function attachEnvelopes<T extends { id: string }>(
  serviceClient: SupabaseClient,
  userId: string,
  messages: T[]
): Promise<Array<T & { e2ee_envelopes: Array<{ recipient_device_id: number; message_type: number; ciphertext: string }> }>> {
  if (messages.length === 0) return []
  const ids = messages.map((message) => message.id)
  const { data, error } = await serviceClient
    .from('e2ee_envelopes')
    .select('message_id, recipient_device_id, message_type, ciphertext')
    .in('message_id', ids)
    .eq('recipient_user_id', userId)
  if (error) {
    if (isMissingE2eeSchema(error)) {
      return messages.map((message) => ({ ...message, e2ee_envelopes: [] }))
    }
    throw new E2eeRequestError(error.message, 400, 'E2EE_INVALID')
  }
  const byMessage = new Map<string, Array<{ recipient_device_id: number; message_type: number; ciphertext: string }>>()
  for (const row of data || []) {
    const list = byMessage.get(row.message_id) || []
    list.push({
      recipient_device_id: row.recipient_device_id,
      message_type: row.message_type,
      ciphertext: row.ciphertext,
    })
    byMessage.set(row.message_id, list)
  }
  return messages.map((message) => ({
    ...message,
    e2ee_envelopes: byMessage.get(message.id) || [],
  }))
}

export function e2eePreview(): string {
  return E2EE_THREAD_PREVIEW
}

export function isE2eeVersion(value: unknown): boolean {
  return Number(value) === E2EE_VERSION
}

function isMissingE2eeSchema(error: { code?: string; message?: string }): boolean {
  const message = error.message || ''
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(message)
}
