import type { SupabaseClient } from '@supabase/supabase-js'
import { assertPublicKeyMaterial, E2eeRequestError } from './server'

export interface DeviceRegistrationBody {
  device_name?: string
  registration_id?: number
  identity_key_public?: string
  signed_prekey?: { key_id?: number; public_key?: string; signature?: string }
  prekeys?: Array<{ key_id?: number; public_key?: string }>
  device_id?: number
}

function cleanName(value: string | undefined): string {
  const name = (value || 'Web browser').trim().slice(0, 80)
  return name || 'Web browser'
}

function readRegistration(body: DeviceRegistrationBody) {
  const registrationId = Number(body.registration_id)
  const signed = body.signed_prekey
  const prekeys = Array.isArray(body.prekeys) ? body.prekeys : []
  if (!Number.isInteger(registrationId) || registrationId < 1 || registrationId > 16383) {
    throw new E2eeRequestError('Invalid registration id', 400, 'E2EE_INVALID')
  }
  if (!signed || !Number.isInteger(Number(signed.key_id)) || Number(signed.key_id) < 1) {
    throw new E2eeRequestError('Invalid signed prekey', 400, 'E2EE_INVALID')
  }
  if (prekeys.length < 1 || prekeys.length > 100) {
    throw new E2eeRequestError('Upload between 1 and 100 one-time prekeys', 400, 'E2EE_INVALID')
  }
  const publicPrekeys = prekeys.map((prekey) => {
    const keyId = Number(prekey.key_id)
    if (!Number.isInteger(keyId) || keyId < 1 || typeof prekey.public_key !== 'string') {
      throw new E2eeRequestError('Invalid one-time prekey', 400, 'E2EE_INVALID')
    }
    return { keyId, publicKey: prekey.public_key }
  })
  assertPublicKeyMaterial({
    identityKey: body.identity_key_public || '',
    signedPublic: signed.public_key || '',
    signature: signed.signature || '',
    preKeys: publicPrekeys.map((prekey) => prekey.publicKey),
  })
  return {
    deviceName: cleanName(body.device_name),
    registrationId,
    identityKey: body.identity_key_public as string,
    signedPreKeyId: Number(signed.key_id),
    signedPreKeyPublic: signed.public_key as string,
    signedPreKeySignature: signed.signature as string,
    prekeys: publicPrekeys,
  }
}

async function insertPrekeys(
  serviceClient: SupabaseClient,
  userId: string,
  deviceId: number,
  prekeys: Array<{ keyId: number; publicKey: string }>
): Promise<void> {
  const { error } = await serviceClient.from('device_prekeys').upsert(
    prekeys.map((prekey) => ({
      user_id: userId,
      device_id: deviceId,
      prekey_id: prekey.keyId,
      public_key: prekey.publicKey,
      consumed_at: null,
    })),
    { onConflict: 'user_id,device_id,prekey_id' }
  )
  if (error) throw new E2eeRequestError(error.message, 400, 'E2EE_INVALID')
}

export async function registerDevice(
  serviceClient: SupabaseClient,
  userId: string,
  body: DeviceRegistrationBody
): Promise<number> {
  const parsed = readRegistration(body)
  const { data: existing, error: existingError } = await serviceClient
    .from('user_devices')
    .select('device_id')
    .eq('user_id', userId)
    .order('device_id', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existingError) throw new E2eeRequestError(existingError.message, 400, 'E2EE_INVALID')
  const deviceId = (existing?.device_id || 0) + 1
  const now = new Date().toISOString()
  const { error } = await serviceClient.from('user_devices').insert({
    user_id: userId,
    device_id: deviceId,
    registration_id: parsed.registrationId,
    device_name: parsed.deviceName,
    identity_key_public: parsed.identityKey,
    signed_prekey_id: parsed.signedPreKeyId,
    signed_prekey_public: parsed.signedPreKeyPublic,
    signed_prekey_signature: parsed.signedPreKeySignature,
    created_at: now,
    last_active_at: now,
    signed_prekey_rotated_at: now,
  })
  if (error) throw new E2eeRequestError(error.message, 400, 'E2EE_INVALID')
  await insertPrekeys(serviceClient, userId, deviceId, parsed.prekeys)
  return deviceId
}

export async function restoreDevice(
  serviceClient: SupabaseClient,
  userId: string,
  body: DeviceRegistrationBody
): Promise<number> {
  const deviceId = Number(body.device_id)
  if (!Number.isInteger(deviceId) || deviceId < 1) {
    throw new E2eeRequestError('Invalid device id', 400, 'E2EE_INVALID')
  }
  const parsed = readRegistration(body)
  const now = new Date().toISOString()
  const { error } = await serviceClient.from('user_devices').upsert(
    {
      user_id: userId,
      device_id: deviceId,
      registration_id: parsed.registrationId,
      device_name: parsed.deviceName,
      identity_key_public: parsed.identityKey,
      signed_prekey_id: parsed.signedPreKeyId,
      signed_prekey_public: parsed.signedPreKeyPublic,
      signed_prekey_signature: parsed.signedPreKeySignature,
      last_active_at: now,
      signed_prekey_rotated_at: now,
      revoked_at: null,
    },
    { onConflict: 'user_id,device_id' }
  )
  if (error) throw new E2eeRequestError(error.message, 400, 'E2EE_INVALID')
  await insertPrekeys(serviceClient, userId, deviceId, parsed.prekeys)
  return deviceId
}

export function mapDeviceRow(row: {
  user_id: string
  device_id: number
  registration_id: number
  device_name: string
  identity_key_public: string
  signed_prekey_id: number
  signed_prekey_public: string
  signed_prekey_signature: string
  last_active_at: string
  created_at: string
  prekeysRemaining?: number
}) {
  return {
    userId: row.user_id,
    deviceId: row.device_id,
    registrationId: row.registration_id,
    deviceName: row.device_name,
    identityKey: row.identity_key_public,
    signedPreKey: {
      keyId: row.signed_prekey_id,
      publicKey: row.signed_prekey_public,
      signature: row.signed_prekey_signature,
    },
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
    ...(typeof row.prekeysRemaining === 'number' ? { prekeysRemaining: row.prekeysRemaining } : {}),
  }
}
