import type { SupabaseClient } from '@supabase/supabase-js'
import { matrixUserId, userIdFromMatrix } from '@/lib/message-e2ee/ids'

type ServiceClient = SupabaseClient

const MAX_BODY = 256_000

async function sharesChat(service: ServiceClient, left: string, right: string): Promise<boolean> {
  if (left === right) return true
  const { data: mine, error } = await service
    .from('chat_participants')
    .select('thread_id')
    .eq('user_id', left)
  if (error || !mine?.length) return false
  const threadIds = mine.map((row) => row.thread_id).filter(Boolean)
  if (threadIds.length === 0) return false
  const { data: shared } = await service
    .from('chat_participants')
    .select('thread_id')
    .eq('user_id', right)
    .in('thread_id', threadIds)
    .limit(1)
  return Boolean(shared?.length)
}

async function assertDevice(service: ServiceClient, userId: string, deviceId: string) {
  const { data } = await service
    .from('crypto_device_keys')
    .select('device_id')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle()
  if (!data) throw new Error('This device has not published encryption keys')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readKeyObject(source: Record<string, unknown>, names: string[]): Record<string, unknown> | null {
  for (const name of names) {
    const value = asRecord(source[name])
    if (value) return value
  }
  return null
}

async function countUnclaimed(service: ServiceClient, userId: string, deviceId: string): Promise<number> {
  const { count } = await service
    .from('crypto_one_time_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .is('claimed_at', null)
    .like('key_id', 'signed_curve25519:%')
  return count ?? 0
}

async function storeUploadedKeys(
  service: ServiceClient,
  userId: string,
  deviceId: string,
  body: Record<string, unknown>,
) {
  const deviceKeys = asRecord(body.device_keys)
  if (deviceKeys) {
    const claimedUser = typeof deviceKeys.user_id === 'string' ? userIdFromMatrix(deviceKeys.user_id) : null
    const claimedDevice = typeof deviceKeys.device_id === 'string' ? deviceKeys.device_id : ''
    if (claimedUser !== userId || claimedDevice !== deviceId) {
      throw new Error('Device keys do not belong to this account')
    }
    const { error } = await service.from('crypto_device_keys').upsert(
      {
        user_id: userId,
        device_id: deviceId,
        device_keys: deviceKeys,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_id' },
    )
    if (error) throw new Error(error.message)
  } else {
    await assertDevice(service, userId, deviceId)
  }

  const oneTime = asRecord(body.one_time_keys)
  if (oneTime) {
    const rows = Object.entries(oneTime)
      .filter(([keyId, value]) => keyId.startsWith('signed_curve25519:') && value && typeof value === 'object')
      .slice(0, 200)
      .map(([keyId, value]) => ({
        user_id: userId,
        device_id: deviceId,
        key_id: keyId,
        key_json: value,
      }))
    if (rows.length > 0) {
      const { error } = await service
        .from('crypto_one_time_keys')
        .upsert(rows, { onConflict: 'user_id,device_id,key_id', ignoreDuplicates: true })
      if (error) throw new Error(error.message)
    }
  }

  const fallback = asRecord(body.fallback_keys)
  if (fallback) {
    const entry = Object.entries(fallback).find(([keyId]) => keyId.startsWith('signed_curve25519:'))
    if (entry) {
      const { error } = await service.from('crypto_fallback_keys').upsert(
        {
          user_id: userId,
          device_id: deviceId,
          key_id: entry[0],
          key_json: entry[1],
          created_at: new Date().toISOString(),
          used_at: null,
        },
        { onConflict: 'user_id,device_id' },
      )
      if (error) throw new Error(error.message)
    }
  }
}

async function queryKeys(service: ServiceClient, requesterId: string, body: Record<string, unknown>) {
  const requested = asRecord(body.device_keys) ?? {}
  const deviceKeys: Record<string, Record<string, unknown>> = {}
  const masterKeys: Record<string, unknown> = {}
  const selfSigningKeys: Record<string, unknown> = {}
  const userSigningKeys: Record<string, unknown> = {}

  for (const matrixId of Object.keys(requested)) {
    const userId = userIdFromMatrix(matrixId)
    if (!userId || !(await sharesChat(service, requesterId, userId))) continue
    const { data: devices } = await service
      .from('crypto_device_keys')
      .select('device_id, device_keys')
      .eq('user_id', userId)
    const byDevice: Record<string, unknown> = {}
    for (const row of devices || []) {
      if (row.device_id && row.device_keys) byDevice[row.device_id] = row.device_keys
    }
    deviceKeys[matrixId] = byDevice
    const { data: identity } = await service
      .from('crypto_identities')
      .select('master_key, self_signing_key, user_signing_key')
      .eq('user_id', userId)
      .maybeSingle()
    if (identity?.master_key) masterKeys[matrixId] = identity.master_key
    if (identity?.self_signing_key) selfSigningKeys[matrixId] = identity.self_signing_key
    if (identity?.user_signing_key) userSigningKeys[matrixId] = identity.user_signing_key
  }

  return {
    device_keys: deviceKeys,
    master_keys: masterKeys,
    self_signing_keys: selfSigningKeys,
    user_signing_keys: userSigningKeys,
    failures: {},
  }
}

async function claimKeys(service: ServiceClient, requesterId: string, body: Record<string, unknown>) {
  const requested = asRecord(body.one_time_keys) ?? {}
  const oneTimeKeys: Record<string, Record<string, unknown>> = {}
  for (const [matrixId, devices] of Object.entries(requested)) {
    const userId = userIdFromMatrix(matrixId)
    const deviceMap = asRecord(devices)
    if (!userId || !deviceMap || !(await sharesChat(service, requesterId, userId))) continue
    const claimed: Record<string, unknown> = {}
    for (const deviceId of Object.keys(deviceMap)) {
      const { data, error } = await service.rpc('crypto_claim_one_time_key', {
        p_user_id: userId,
        p_device_id: deviceId,
      })
      if (error) throw new Error(error.message)
      const row = asRecord(data)
      if (row && typeof row.id === 'string' && row.key) {
        claimed[deviceId] = { [row.id]: row.key }
        continue
      }
      const { data: fallback } = await service
        .from('crypto_fallback_keys')
        .select('key_id, key_json, used_at')
        .eq('user_id', userId)
        .eq('device_id', deviceId)
        .maybeSingle()
      if (fallback?.key_id && fallback.key_json && !fallback.used_at) {
        await service
          .from('crypto_fallback_keys')
          .update({ used_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('device_id', deviceId)
        claimed[deviceId] = { [fallback.key_id]: fallback.key_json }
      }
    }
    if (Object.keys(claimed).length > 0) oneTimeKeys[matrixId] = claimed
  }
  return { one_time_keys: oneTimeKeys, failures: {} }
}

async function storeSigningKeys(service: ServiceClient, userId: string, body: Record<string, unknown>) {
  const master = readKeyObject(body, ['master_key', 'master_keys'])
  const selfSigning = readKeyObject(body, ['self_signing_key', 'self_signing_keys'])
  const userSigning = readKeyObject(body, ['user_signing_key', 'user_signing_keys'])
  const { data: existing } = await service
    .from('crypto_identities')
    .select('master_key')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing?.master_key) return { existing: true }
  const { error } = await service.from('crypto_identities').insert({
    user_id: userId,
    master_key: master,
    self_signing_key: selfSigning,
    user_signing_key: userSigning,
    updated_at: new Date().toISOString(),
  })
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { existing: true }
    throw new Error(error.message)
  }
  return { existing: false }
}

function sameKeys(left: unknown, right: unknown): boolean {
  return JSON.stringify(asRecord(left)?.keys ?? null) === JSON.stringify(asRecord(right)?.keys ?? null)
}

async function storeSignatures(service: ServiceClient, userId: string, body: Record<string, unknown>) {
  const nested = asRecord(body[matrixUserId(userId)]) ?? body
  const master = readKeyObject(nested, ['master_key', 'master_keys'])
  const selfSigning = readKeyObject(nested, ['self_signing_key', 'self_signing_keys'])
  const userSigning = readKeyObject(nested, ['user_signing_key', 'user_signing_keys'])
  const { data: existing } = await service
    .from('crypto_identities')
    .select('master_key, self_signing_key, user_signing_key')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing?.master_key) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (master && sameKeys(existing.master_key, master)) patch.master_key = master
    if (selfSigning && sameKeys(existing.self_signing_key, selfSigning)) patch.self_signing_key = selfSigning
    if (userSigning && sameKeys(existing.user_signing_key, userSigning)) patch.user_signing_key = userSigning
    await service.from('crypto_identities').update(patch).eq('user_id', userId)
  }
  const devices = asRecord(nested.devices)
  if (!devices) return { ok: true }
  for (const [deviceId, value] of Object.entries(devices)) {
    const deviceKeys = asRecord(value)
    if (!deviceKeys) continue
    if (userIdFromMatrix(String(deviceKeys.user_id || '')) !== userId) continue
    if (deviceKeys.device_id !== deviceId) continue
    await service
      .from('crypto_device_keys')
      .update({ device_keys: deviceKeys, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('device_id', deviceId)
  }
  return { ok: true }
}

async function storeToDevice(
  service: ServiceClient,
  senderId: string,
  eventType: string,
  body: Record<string, unknown>,
) {
  const messages = asRecord(body.messages) ?? {}
  const rows: Array<Record<string, unknown>> = []
  for (const [matrixId, devices] of Object.entries(messages)) {
    const recipientId = userIdFromMatrix(matrixId)
    const deviceMap = asRecord(devices)
    if (!recipientId || !deviceMap || !(await sharesChat(service, senderId, recipientId))) continue
    for (const [deviceId, content] of Object.entries(deviceMap)) {
      if (!content || typeof content !== 'object') continue
      rows.push({
        recipient_user_id: recipientId,
        recipient_device_id: deviceId,
        sender_user_id: senderId,
        event_type: eventType || 'm.room.encrypted',
        content,
      })
    }
  }
  if (rows.length === 0) return { ok: true }
  const { error } = await service.from('crypto_to_device').insert(rows)
  if (error) throw new Error(error.message)
  return { ok: true }
}

export async function messageCryptoReady(service: ServiceClient): Promise<boolean> {
  const { error } = await service.from('crypto_device_keys').select('user_id').limit(1)
  return !error
}

export async function handleMessageCryptoRequest(
  service: ServiceClient,
  userId: string,
  input: { type?: number | string; body?: string; eventType?: string; deviceId?: string },
) {
  if (typeof input.body !== 'string' || input.body.length === 0 || input.body.length > MAX_BODY) {
    throw new Error('Encryption request is empty')
  }
  let parsed: Record<string, unknown>
  try {
    const value = JSON.parse(input.body) as unknown
    const record = asRecord(value)
    if (!record) throw new Error('bad')
    parsed = record
  } catch {
    throw new Error('Encryption request could not be read')
  }

  if (input.type === 'signing-keys') return storeSigningKeys(service, userId, parsed)
  if (input.type === 0) {
    const deviceId = typeof input.deviceId === 'string' ? input.deviceId.trim() : ''
    if (!deviceId) throw new Error('Device id is required')
    await storeUploadedKeys(service, userId, deviceId, parsed)
    return { one_time_key_counts: { signed_curve25519: await countUnclaimed(service, userId, deviceId) } }
  }
  if (input.type === 1) return queryKeys(service, userId, parsed)
  if (input.type === 2) return claimKeys(service, userId, parsed)
  if (input.type === 3) {
    return storeToDevice(service, userId, input.eventType || 'm.room.encrypted', parsed)
  }
  if (input.type === 4) return storeSignatures(service, userId, parsed)
  return {}
}

export async function pullMessageCryptoSync(service: ServiceClient, userId: string, deviceId: string) {
  await assertDevice(service, userId, deviceId)
  const { data, error } = await service
    .from('crypto_to_device')
    .select('id, event_type, content, sender_user_id, created_at')
    .eq('recipient_user_id', userId)
    .eq('recipient_device_id', deviceId)
    .order('created_at', { ascending: true })
    .limit(50)
  if (error) throw new Error(error.message)
  const events = (data || []).map((row) => ({
    id: row.id as string,
    type: row.event_type as string,
    sender: matrixUserId(row.sender_user_id as string),
    content: row.content,
  }))
  const { data: fallback } = await service
    .from('crypto_fallback_keys')
    .select('used_at')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle()
  return {
    events,
    oneTimeKeyCount: await countUnclaimed(service, userId, deviceId),
    unusedFallback: fallback && !fallback.used_at ? ['signed_curve25519'] : [],
  }
}

export async function ackMessageCryptoSync(service: ServiceClient, userId: string, ids: string[]) {
  const unique = [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))].slice(0, 50)
  if (unique.length === 0) return { deleted: 0 }
  const { error, count } = await service
    .from('crypto_to_device')
    .delete({ count: 'exact' })
    .eq('recipient_user_id', userId)
    .in('id', unique)
  if (error) throw new Error(error.message)
  return { deleted: count ?? 0 }
}
