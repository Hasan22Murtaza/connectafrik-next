import type { SupabaseClient } from '@supabase/supabase-js'

type ServiceClient = SupabaseClient

const MAX_BODY = 256_000
const PROTOCOL = 'signal'

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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

async function countUnclaimed(service: ServiceClient, userId: string, deviceId: string): Promise<number> {
  const { count } = await service
    .from('crypto_one_time_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .is('claimed_at', null)
    .like('key_id', 'signal:%')
  return count ?? 0
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

async function registerDevice(
  service: ServiceClient,
  userId: string,
  deviceId: string,
  body: Record<string, unknown>,
) {
  const identityKey = typeof body.identity_key === 'string' ? body.identity_key : ''
  const registrationId = typeof body.registration_id === 'number' ? body.registration_id : Number(body.registration_id)
  const signed = asRecord(body.signed_prekey)
  if (!identityKey || !Number.isFinite(registrationId) || !signed) {
    throw new Error('Device registration is incomplete')
  }
  const signedKeyId = typeof signed.key_id === 'number' ? signed.key_id : Number(signed.key_id)
  const signedPublic = typeof signed.public_key === 'string' ? signed.public_key : ''
  const signedSignature = typeof signed.signature === 'string' ? signed.signature : ''
  if (!Number.isFinite(signedKeyId) || !signedPublic || !signedSignature) {
    throw new Error('Signed prekey is incomplete')
  }

  const { data: existingDevices } = await service
    .from('crypto_device_keys')
    .select('device_id')
    .eq('user_id', userId)
    .limit(5)

  const deviceKeys = {
    protocol: PROTOCOL,
    version: 1,
    user_id: userId,
    device_id: deviceId,
    identity_key: identityKey,
    registration_id: registrationId,
    signed_prekey: {
      key_id: signedKeyId,
      public_key: signedPublic,
      signature: signedSignature,
    },
    device_name: typeof body.device_name === 'string' ? body.device_name.slice(0, 120) : 'Web',
    platform: typeof body.platform === 'string' ? body.platform.slice(0, 32) : 'web',
    last_seen_at: new Date().toISOString(),
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

  const oneTime = Array.isArray(body.one_time_prekeys) ? body.one_time_prekeys : []
  const rows = oneTime
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .slice(0, 200)
    .map((item) => {
      const keyId = typeof item.key_id === 'number' ? item.key_id : Number(item.key_id)
      const publicKey = typeof item.public_key === 'string' ? item.public_key : ''
      if (!Number.isFinite(keyId) || !publicKey) return null
      return {
        user_id: userId,
        device_id: deviceId,
        key_id: `signal:${keyId}`,
        key_json: { key_id: keyId, public_key: publicKey, protocol: PROTOCOL },
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  if (rows.length > 0) {
    const { error: otkError } = await service
      .from('crypto_one_time_keys')
      .upsert(rows, { onConflict: 'user_id,device_id,key_id', ignoreDuplicates: true })
    if (otkError) throw new Error(otkError.message)
  }

  const isFirstDevice = !existingDevices?.some((row) => row.device_id && row.device_id !== deviceId)
  return {
    one_time_key_counts: { signal: await countUnclaimed(service, userId, deviceId) },
    is_first_device: isFirstDevice,
  }
}

function parseDeviceRow(row: { device_id: string; device_keys: unknown; updated_at?: string }) {
  const keys = asRecord(row.device_keys)
  if (!keys || keys.protocol !== PROTOCOL) return null
  const signed = asRecord(keys.signed_prekey)
  if (!signed) return null
  return {
    user_id: typeof keys.user_id === 'string' ? keys.user_id : null,
    device_id: row.device_id,
    identity_key: typeof keys.identity_key === 'string' ? keys.identity_key : '',
    registration_id: typeof keys.registration_id === 'number' ? keys.registration_id : Number(keys.registration_id),
    signed_prekey: {
      key_id: typeof signed.key_id === 'number' ? signed.key_id : Number(signed.key_id),
      public_key: typeof signed.public_key === 'string' ? signed.public_key : '',
      signature: typeof signed.signature === 'string' ? signed.signature : '',
    },
    device_name: typeof keys.device_name === 'string' ? keys.device_name : 'Device',
    platform: typeof keys.platform === 'string' ? keys.platform : 'web',
    last_seen_at:
      (typeof keys.last_seen_at === 'string' && keys.last_seen_at) ||
      row.updated_at ||
      new Date().toISOString(),
  }
}

async function listDevices(service: ServiceClient, requesterId: string, body: Record<string, unknown>) {
  const userIds = Array.isArray(body.user_ids)
    ? body.user_ids.filter((id): id is string => typeof id === 'string' && id.length > 0).slice(0, 50)
    : []
  const devices: Record<string, Array<ReturnType<typeof parseDeviceRow>>> = {}
  for (const userId of userIds) {
    if (!(await sharesChat(service, requesterId, userId))) continue
    const { data } = await service
      .from('crypto_device_keys')
      .select('device_id, device_keys, updated_at')
      .eq('user_id', userId)
    const parsed = (data || [])
      .map((row) => parseDeviceRow(row as { device_id: string; device_keys: unknown; updated_at?: string }))
      .filter((row): row is NonNullable<typeof row> => Boolean(row?.identity_key && row.signed_prekey.public_key))
    devices[userId] = parsed
  }
  return { devices }
}

async function claimBundle(service: ServiceClient, requesterId: string, body: Record<string, unknown>) {
  const userId = typeof body.user_id === 'string' ? body.user_id : ''
  const deviceId = typeof body.device_id === 'string' ? body.device_id : ''
  if (!userId || !deviceId) throw new Error('Device id is required')
  if (!(await sharesChat(service, requesterId, userId))) {
    throw new Error('Device keys do not belong to this account')
  }
  const { data } = await service
    .from('crypto_device_keys')
    .select('device_id, device_keys, updated_at')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle()
  if (!data) throw new Error('That device has not published encryption keys')
  const device = parseDeviceRow(data as { device_id: string; device_keys: unknown; updated_at?: string })
  if (!device) throw new Error('That device has not published encryption keys')

  let oneTimePreKey: { key_id: number; public_key: string } | null = null
  const { data: claimed, error } = await service.rpc('crypto_claim_one_time_key', {
    p_user_id: userId,
    p_device_id: deviceId,
  })
  if (error) throw new Error(error.message)
  const claimedRow = asRecord(claimed)
  if (claimedRow && typeof claimedRow.id === 'string' && claimedRow.key) {
    const keyJson = asRecord(claimedRow.key)
    const keyId =
      typeof keyJson?.key_id === 'number'
        ? keyJson.key_id
        : Number(String(claimedRow.id).replace(/^signal:/, ''))
    const publicKey = typeof keyJson?.public_key === 'string' ? keyJson.public_key : ''
    if (Number.isFinite(keyId) && publicKey) {
      oneTimePreKey = { key_id: keyId, public_key: publicKey }
    }
  }

  return {
    bundle: {
      user_id: userId,
      device_id: device.device_id,
      identity_key: device.identity_key,
      registration_id: device.registration_id,
      signed_prekey: device.signed_prekey,
      one_time_prekey: oneTimePreKey,
      device_name: device.device_name,
      platform: device.platform,
      last_seen_at: device.last_seen_at,
    },
  }
}

async function storeToDevice(
  service: ServiceClient,
  senderId: string,
  eventType: string,
  body: Record<string, unknown>,
) {
  const messages = asRecord(body.messages) ?? {}
  const rows: Array<Record<string, unknown>> = []
  for (const [recipientId, devices] of Object.entries(messages)) {
    const deviceMap = asRecord(devices)
    if (!deviceMap || !(await sharesChat(service, senderId, recipientId))) continue
    for (const [deviceId, content] of Object.entries(deviceMap)) {
      if (!content || typeof content !== 'object') continue
      rows.push({
        recipient_user_id: recipientId,
        recipient_device_id: deviceId,
        sender_user_id: senderId,
        event_type: eventType || 'cribstalk.signal',
        content,
      })
    }
  }
  if (rows.length === 0) return { ok: true }
  const { error } = await service.from('crypto_to_device').insert(rows)
  if (error) throw new Error(error.message)
  return { ok: true }
}

async function revokeDevice(service: ServiceClient, userId: string, deviceId: string) {
  await service.from('crypto_device_keys').delete().eq('user_id', userId).eq('device_id', deviceId)
  await service.from('crypto_one_time_keys').delete().eq('user_id', userId).eq('device_id', deviceId)
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

  const type = input.type
  if (type === 0 || type === 'register') {
    const deviceId = typeof input.deviceId === 'string' ? input.deviceId.trim() : ''
    if (!deviceId) throw new Error('Device id is required')
    return registerDevice(service, userId, deviceId, parsed)
  }
  if (type === 1 || type === 'devices') return listDevices(service, userId, parsed)
  if (type === 2 || type === 'claim') return claimBundle(service, userId, parsed)
  if (type === 3 || type === 'to-device') {
    return storeToDevice(service, userId, input.eventType || 'cribstalk.signal', parsed)
  }
  if (type === 'revoke') {
    const target =
      (typeof parsed.device_id === 'string' && parsed.device_id.trim()) ||
      (typeof input.deviceId === 'string' && input.deviceId.trim()) ||
      ''
    if (!target) throw new Error('Device id is required')
    return revokeDevice(service, userId, target)
  }
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
    sender: row.sender_user_id as string,
    content: row.content,
  }))
  return {
    events,
    oneTimeKeyCount: await countUnclaimed(service, userId, deviceId),
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
