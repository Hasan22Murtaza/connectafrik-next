import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DeviceLinkError,
  LINK_ERROR,
  LINK_SESSION_TTL_MS,
  MAX_PENDING_LINK_SESSIONS_PER_DEVICE,
  MAX_PENDING_LINK_SESSIONS_PER_USER,
  canApproveLinkStatus,
  humanLinkError,
  isDeviceId,
  isIdentityPublicKey,
  linkErrorFromRpcMessage,
  resolveLinkSessionStatus,
  type LinkSessionStatus,
} from '@/lib/message-e2ee/device-link-logic'
import { assertRateLimit } from '@/lib/message-e2ee/rate-limit'

/** Same wire format as device.ts linkPayload — keep server free of 'use client' imports. */
function qrPayload(userId: string, deviceId: string): string {
  return `cribstalk-link:2:${userId.trim().toLowerCase()}:${deviceId}`
}

type ServiceClient = SupabaseClient

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readIdentityKey(deviceKeys: unknown): string {
  const keys = asRecord(deviceKeys)
  const identity = typeof keys?.identity_key === 'string' ? keys.identity_key : ''
  return identity
}

async function loadRegisteredDevice(
  service: ServiceClient,
  userId: string,
  deviceId: string,
): Promise<{ deviceId: string; identityKey: string; deviceName: string; platform: string; createdAt: string; updatedAt: string } | null> {
  const { data, error } = await service
    .from('crypto_device_keys')
    .select('device_id, device_keys, created_at, updated_at')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const keys = asRecord(data.device_keys)
  const identityKey = readIdentityKey(data.device_keys)
  if (!identityKey) return null
  return {
    deviceId: data.device_id as string,
    identityKey,
    deviceName: typeof keys?.device_name === 'string' ? keys.device_name : 'Device',
    platform: typeof keys?.platform === 'string' ? keys.platform : 'web',
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
  }
}

async function expireStaleSession(
  service: ServiceClient,
  session: { id: string; status: string; expires_at: string },
): Promise<LinkSessionStatus> {
  const resolved = resolveLinkSessionStatus(session.status as LinkSessionStatus, session.expires_at)
  if (resolved === 'expired' && session.status !== 'expired') {
    await service
      .from('crypto_device_link_sessions')
      .update({ status: 'expired' })
      .eq('id', session.id)
      .in('status', ['pending', 'scanned', 'approved'])
  }
  return resolved
}

export async function createDeviceLinkSession(
  service: ServiceClient,
  userId: string,
  input: {
    deviceId: string
    deviceType?: string
    platform?: string
    deviceName?: string
    publicKey?: string
  },
) {
  assertRateLimit({ key: `link:create:${userId}`, limit: 10, windowMs: 60_000 })

  const deviceId = input.deviceId.trim()
  if (!isDeviceId(deviceId)) {
    throw new DeviceLinkError(LINK_ERROR.DEVICE_NOT_FOUND, humanLinkError(LINK_ERROR.DEVICE_NOT_FOUND), 400)
  }

  const registered = await loadRegisteredDevice(service, userId, deviceId)
  if (!registered) {
    throw new DeviceLinkError(LINK_ERROR.DEVICE_NOT_FOUND, humanLinkError(LINK_ERROR.DEVICE_NOT_FOUND), 404)
  }

  if (input.publicKey && input.publicKey !== registered.identityKey) {
    throw new DeviceLinkError(
      LINK_ERROR.DEVICE_PUBLIC_KEY_MISMATCH,
      humanLinkError(LINK_ERROR.DEVICE_PUBLIC_KEY_MISMATCH),
      400,
    )
  }
  if (!isIdentityPublicKey(registered.identityKey)) {
    throw new DeviceLinkError(
      LINK_ERROR.DEVICE_PUBLIC_KEY_MISMATCH,
      humanLinkError(LINK_ERROR.DEVICE_PUBLIC_KEY_MISMATCH),
      400,
    )
  }

  const { count: userPending } = await service
    .from('crypto_device_link_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['pending', 'scanned'])
    .gt('expires_at', new Date().toISOString())
  if ((userPending ?? 0) >= MAX_PENDING_LINK_SESSIONS_PER_USER) {
    throw new DeviceLinkError(LINK_ERROR.RATE_LIMITED, humanLinkError(LINK_ERROR.RATE_LIMITED), 429)
  }

  // Cancel prior open sessions for this device (single active QR).
  await service
    .from('crypto_device_link_sessions')
    .update({ status: 'cancelled' })
    .eq('user_id', userId)
    .eq('target_device_id', deviceId)
    .in('status', ['pending', 'scanned'])

  const { count: devicePending } = await service
    .from('crypto_device_link_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('target_device_id', deviceId)
    .in('status', ['pending', 'scanned'])
    .gt('expires_at', new Date().toISOString())
  if ((devicePending ?? 0) >= MAX_PENDING_LINK_SESSIONS_PER_DEVICE) {
    throw new DeviceLinkError(LINK_ERROR.RATE_LIMITED, humanLinkError(LINK_ERROR.RATE_LIMITED), 429)
  }

  const expiresAt = new Date(Date.now() + LINK_SESSION_TTL_MS).toISOString()
  const { data, error } = await service
    .from('crypto_device_link_sessions')
    .insert({
      user_id: userId,
      target_device_id: deviceId,
      target_identity_key: registered.identityKey,
      device_name: (input.deviceName || registered.deviceName || 'Web').slice(0, 120),
      platform: (input.platform || registered.platform || 'web').slice(0, 32),
      device_type: (input.deviceType || 'browser').slice(0, 32),
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('id, target_device_id, status, expires_at')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Could not create linking session')
  }

  return {
    sessionId: data.id as string,
    deviceId: data.target_device_id as string,
    expiresAt: data.expires_at as string,
    status: 'pending' as const,
    // Existing wire format — no private material.
    qrPayload: qrPayload(userId, deviceId),
  }
}

export async function getDeviceLinkSession(
  service: ServiceClient,
  userId: string,
  sessionId: string,
) {
  const { data, error } = await service
    .from('crypto_device_link_sessions')
    .select('id, target_device_id, status, expires_at, approved_at, completed_at')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) {
    throw new DeviceLinkError(LINK_ERROR.LINK_SESSION_NOT_FOUND, humanLinkError(LINK_ERROR.LINK_SESSION_NOT_FOUND), 404)
  }

  const status = await expireStaleSession(service, {
    id: data.id as string,
    status: data.status as string,
    expires_at: data.expires_at as string,
  })

  return {
    sessionId: data.id as string,
    deviceId: data.target_device_id as string,
    status,
    expiresAt: data.expires_at as string,
    approvedAt: (data.approved_at as string) || null,
    completedAt: (data.completed_at as string) || null,
  }
}

export async function markDeviceLinkScanned(
  service: ServiceClient,
  userId: string,
  sessionId: string,
) {
  const current = await getDeviceLinkSession(service, userId, sessionId)
  if (current.status === 'expired') {
    throw new DeviceLinkError(LINK_ERROR.LINK_SESSION_EXPIRED, humanLinkError(LINK_ERROR.LINK_SESSION_EXPIRED), 400)
  }
  if (!canApproveLinkStatus(current.status) && current.status !== 'approved') {
    throw new DeviceLinkError(
      LINK_ERROR.LINK_SESSION_ALREADY_USED,
      humanLinkError(LINK_ERROR.LINK_SESSION_ALREADY_USED),
      400,
    )
  }
  if (current.status === 'pending') {
    await service
      .from('crypto_device_link_sessions')
      .update({ status: 'scanned' })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .eq('status', 'pending')
  }
  return getDeviceLinkSession(service, userId, sessionId)
}

export async function approveDeviceLinkSession(
  service: ServiceClient,
  userId: string,
  input: {
    sessionId: string
    deviceId: string
    publicKey: string
    approverDeviceId: string
  },
) {
  assertRateLimit({ key: `link:approve:${userId}`, limit: 20, windowMs: 60_000 })

  if (!isDeviceId(input.deviceId) || !isDeviceId(input.approverDeviceId)) {
    throw new DeviceLinkError(LINK_ERROR.DEVICE_NOT_AUTHORIZED, humanLinkError(LINK_ERROR.DEVICE_NOT_AUTHORIZED), 403)
  }
  if (!isIdentityPublicKey(input.publicKey)) {
    throw new DeviceLinkError(
      LINK_ERROR.DEVICE_PUBLIC_KEY_MISMATCH,
      humanLinkError(LINK_ERROR.DEVICE_PUBLIC_KEY_MISMATCH),
      400,
    )
  }

  const { data, error } = await service.rpc('crypto_approve_device_link_session', {
    p_session_id: input.sessionId,
    p_user_id: userId,
    p_target_device_id: input.deviceId,
    p_identity_key: input.publicKey,
    p_approver_device_id: input.approverDeviceId,
  })

  if (error) {
    const mapped = linkErrorFromRpcMessage(error.message || '')
    if (mapped) throw mapped
    throw new DeviceLinkError(LINK_ERROR.LINK_APPROVAL_FAILED, humanLinkError(LINK_ERROR.LINK_APPROVAL_FAILED), 400)
  }

  const record = asRecord(data)
  return {
    sessionId: typeof record?.sessionId === 'string' ? record.sessionId : input.sessionId,
    deviceId: typeof record?.deviceId === 'string' ? record.deviceId : input.deviceId,
    status: 'approved' as const,
    approvedByDeviceId:
      typeof record?.approvedByDeviceId === 'string' ? record.approvedByDeviceId : input.approverDeviceId,
  }
}

export async function completeDeviceLinkSession(
  service: ServiceClient,
  userId: string,
  input: { sessionId: string; deviceId: string },
) {
  assertRateLimit({ key: `link:complete:${userId}`, limit: 20, windowMs: 60_000 })

  if (!isDeviceId(input.deviceId)) {
    throw new DeviceLinkError(LINK_ERROR.DEVICE_NOT_FOUND, humanLinkError(LINK_ERROR.DEVICE_NOT_FOUND), 400)
  }

  const { data, error } = await service.rpc('crypto_complete_device_link_session', {
    p_session_id: input.sessionId,
    p_user_id: userId,
    p_target_device_id: input.deviceId,
  })

  if (error) {
    const mapped = linkErrorFromRpcMessage(error.message || '')
    if (mapped) throw mapped
    throw new DeviceLinkError(LINK_ERROR.LINK_COMPLETION_FAILED, humanLinkError(LINK_ERROR.LINK_COMPLETION_FAILED), 400)
  }

  const record = asRecord(data)
  return {
    sessionId: typeof record?.sessionId === 'string' ? record.sessionId : input.sessionId,
    deviceId: typeof record?.deviceId === 'string' ? record.deviceId : input.deviceId,
    status: 'completed' as const,
  }
}

export async function listLinkedCryptoDevices(
  service: ServiceClient,
  userId: string,
  currentDeviceId?: string,
) {
  const { data, error } = await service
    .from('crypto_device_keys')
    .select('device_id, device_keys, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  const devices = (data || []).map((row) => {
    const keys = asRecord(row.device_keys)
    const deviceId = row.device_id as string
    const lastSeenAt =
      (typeof keys?.last_seen_at === 'string' && keys.last_seen_at) ||
      (row.updated_at as string) ||
      (row.created_at as string) ||
      new Date().toISOString()
    const platform = typeof keys?.platform === 'string' ? keys.platform : 'web'
    const deviceName = typeof keys?.device_name === 'string' ? keys.device_name : 'Device'
    const deviceType =
      platform === 'ios' || platform === 'android' || platform === 'mobile' ? 'mobile' : 'browser'
    return {
      deviceId,
      deviceName,
      platform,
      deviceType,
      createdAt: (row.created_at as string) || lastSeenAt,
      lastSeenAt,
      isCurrentDevice: Boolean(currentDeviceId && currentDeviceId === deviceId),
      status: 'trusted' as const,
    }
  })

  return { devices }
}

export async function getCurrentCryptoDevice(
  service: ServiceClient,
  userId: string,
  deviceId: string,
) {
  if (!isDeviceId(deviceId)) {
    throw new DeviceLinkError(LINK_ERROR.DEVICE_NOT_FOUND, humanLinkError(LINK_ERROR.DEVICE_NOT_FOUND), 400)
  }
  const registered = await loadRegisteredDevice(service, userId, deviceId)
  if (!registered) {
    throw new DeviceLinkError(LINK_ERROR.DEVICE_NOT_FOUND, humanLinkError(LINK_ERROR.DEVICE_NOT_FOUND), 404)
  }
  return {
    deviceId: registered.deviceId,
    status: 'trusted' as const,
    deviceName: registered.deviceName,
    platform: registered.platform,
    lastSeenAt: registered.updatedAt,
    createdAt: registered.createdAt,
  }
}

export async function revokeLinkedCryptoDevice(
  service: ServiceClient,
  userId: string,
  deviceId: string,
  requesterDeviceId?: string,
) {
  assertRateLimit({ key: `link:revoke:${userId}`, limit: 30, windowMs: 60_000 })

  if (!isDeviceId(deviceId)) {
    throw new DeviceLinkError(LINK_ERROR.DEVICE_NOT_FOUND, humanLinkError(LINK_ERROR.DEVICE_NOT_FOUND), 400)
  }

  if (requesterDeviceId) {
    if (!isDeviceId(requesterDeviceId)) {
      throw new DeviceLinkError(LINK_ERROR.DEVICE_NOT_AUTHORIZED, humanLinkError(LINK_ERROR.DEVICE_NOT_AUTHORIZED), 403)
    }
    const requester = await loadRegisteredDevice(service, userId, requesterDeviceId)
    if (!requester) {
      throw new DeviceLinkError(LINK_ERROR.DEVICE_NOT_AUTHORIZED, humanLinkError(LINK_ERROR.DEVICE_NOT_AUTHORIZED), 403)
    }
  }

  const existing = await loadRegisteredDevice(service, userId, deviceId)
  if (!existing) {
    throw new DeviceLinkError(LINK_ERROR.DEVICE_ALREADY_REVOKED, humanLinkError(LINK_ERROR.DEVICE_ALREADY_REVOKED), 404)
  }

  await service.from('crypto_device_keys').delete().eq('user_id', userId).eq('device_id', deviceId)
  await service.from('crypto_one_time_keys').delete().eq('user_id', userId).eq('device_id', deviceId)
  await service
    .from('crypto_device_link_sessions')
    .update({ status: 'revoked' })
    .eq('user_id', userId)
    .eq('target_device_id', deviceId)
    .in('status', ['pending', 'scanned', 'approved'])

  return {
    success: true as const,
    deviceId,
    status: 'revoked' as const,
  }
}

/** Resolve a pending session for a target device (owner paste flow without session id). */
export async function findOpenLinkSessionForDevice(
  service: ServiceClient,
  userId: string,
  deviceId: string,
) {
  const { data, error } = await service
    .from('crypto_device_link_sessions')
    .select('id, target_device_id, target_identity_key, status, expires_at')
    .eq('user_id', userId)
    .eq('target_device_id', deviceId)
    .in('status', ['pending', 'scanned'])
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const status = await expireStaleSession(service, {
    id: data.id as string,
    status: data.status as string,
    expires_at: data.expires_at as string,
  })
  if (status === 'expired') return null

  return {
    sessionId: data.id as string,
    deviceId: data.target_device_id as string,
    publicKey: data.target_identity_key as string,
    status,
    expiresAt: data.expires_at as string,
  }
}
