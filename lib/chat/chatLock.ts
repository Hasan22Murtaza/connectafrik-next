import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import type { SupabaseClient } from '@supabase/supabase-js'
import { errorResponse, forbiddenResponse } from '@/lib/api-utils'

export class ChatLockAuthError extends Error {
  status = 403
  code = CHAT_LOCKED_CODE
  constructor(message = 'Authentication required to access this locked chat') {
    super(message)
    this.name = 'ChatLockAuthError'
  }
}

export const CHAT_LOCKED_CODE = 'CHAT_LOCKED'
export const CHAT_LOCK_TOKEN_HEADER = 'x-chat-lock-token'
export const CHAT_LOCK_TOKEN_TTL_SEC = 15 * 60
export const CHAT_LOCK_PIN_MIN = 4
export const CHAT_LOCK_PIN_MAX = 6

type ChatLockTokenPayload = {
  sub: string
  purpose: 'chat_lock'
  thread_id: string
}

function getChatLockSecret(): string {
  return (
    process.env.CHAT_LOCK_SECRET ||
    process.env.AUTH_OTP_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'connectafrik-chat-lock-dev'
  )
}

export function chatLockedResponse(message = 'Authentication required to access this locked chat') {
  return errorResponse(message, 403, { code: CHAT_LOCKED_CODE })
}

export function isValidChatLockPin(pin: unknown): pin is string {
  return typeof pin === 'string' && new RegExp(`^\\d{${CHAT_LOCK_PIN_MIN},${CHAT_LOCK_PIN_MAX}}$`).test(pin)
}

export function hashChatLockPin(pin: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(pin, salt, 32)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifyChatLockPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  try {
    const actual = crypto.scryptSync(pin, Buffer.from(saltHex, 'hex'), 32)
    const expected = Buffer.from(hashHex, 'hex')
    if (actual.length !== expected.length) return false
    return crypto.timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function createChatLockToken(
  userId: string,
  threadId: string
): { token: string; expires_at: string; thread_id: string } {
  const token = jwt.sign(
    { sub: userId, purpose: 'chat_lock', thread_id: threadId } satisfies ChatLockTokenPayload,
    getChatLockSecret(),
    { expiresIn: '15m' }
  )
  return {
    token,
    thread_id: threadId,
    expires_at: new Date(Date.now() + CHAT_LOCK_TOKEN_TTL_SEC * 1000).toISOString(),
  }
}

export function verifyChatLockToken(token: string, userId: string, threadId: string): boolean {
  try {
    const payload = jwt.verify(token, getChatLockSecret()) as ChatLockTokenPayload
    return payload?.purpose === 'chat_lock' && payload.sub === userId && payload.thread_id === threadId
  } catch {
    return false
  }
}

export function readChatLockTokenFromRequest(request: Request): string | null {
  return request.headers.get(CHAT_LOCK_TOKEN_HEADER)?.trim() || null
}

export function isChatLockUnlockedForRequest(request: Request, userId: string, threadId: string): boolean {
  const token = readChatLockTokenFromRequest(request)
  return Boolean(token && verifyChatLockToken(token, userId, threadId))
}

export async function getThreadLockPinHash(
  serviceClient: SupabaseClient,
  userId: string,
  threadId: string
): Promise<string | null> {
  const { data } = await serviceClient
    .from('chat_participants')
    .select('lock_pin_hash')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .maybeSingle()
  const hash = typeof data?.lock_pin_hash === 'string' ? data.lock_pin_hash : ''
  return hash || null
}

export async function setThreadLockPinHash(
  serviceClient: SupabaseClient,
  userId: string,
  threadId: string,
  pin: string
): Promise<void> {
  const { error } = await serviceClient
    .from('chat_participants')
    .update({ lock_pin_hash: hashChatLockPin(pin) })
    .eq('thread_id', threadId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message || 'Failed to save chat PIN')
}

export async function getThreadLockedForUser(
  serviceClient: SupabaseClient,
  userId: string,
  threadId: string
): Promise<boolean> {
  const { data } = await serviceClient
    .from('chat_participants')
    .select('is_locked')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .maybeSingle()
  return Boolean(data?.is_locked)
}

export async function setThreadLockedForUser(
  serviceClient: SupabaseClient,
  userId: string,
  threadId: string,
  locked: boolean,
  pin?: string
): Promise<void> {
  const patch: Record<string, unknown> = {
    is_locked: locked,
    locked_at: locked ? new Date().toISOString() : null,
  }
  if (locked && pin) {
    patch.lock_pin_hash = hashChatLockPin(pin)
  }
  if (!locked) {
    patch.lock_pin_hash = null
  }
  const { error } = await serviceClient
    .from('chat_participants')
    .update(patch)
    .eq('thread_id', threadId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message || 'Failed to update chat lock')
}

export async function getLockedChatSummary(
  serviceClient: SupabaseClient,
  userId: string
): Promise<{ locked_count: number; locked_unread: number }> {
  const { data: rows } = await serviceClient
    .from('chat_participants')
    .select('unread_count')
    .eq('user_id', userId)
    .eq('is_locked', true)
    .is('deleted_at', null)
  const locked = rows ?? []
  return {
    locked_count: locked.length,
    locked_unread: locked.reduce(
      (sum, row) => sum + (typeof row.unread_count === 'number' ? row.unread_count : 0),
      0
    ),
  }
}

export async function requireUnlockedLockedThread(
  request: Request,
  serviceClient: SupabaseClient,
  userId: string,
  threadId: string
): Promise<Response | null> {
  const locked = await getThreadLockedForUser(serviceClient, userId, threadId)
  if (!locked) return null
  if (isChatLockUnlockedForRequest(request, userId, threadId)) return null
  return chatLockedResponse()
}

export async function verifyAccountPassword(email: string | undefined, password: string): Promise<boolean> {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!normalizedEmail || !password) return false
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return false

  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ email: normalizedEmail, password }),
  })
  return res.ok
}

export async function authenticateThreadChatLock(
  serviceClient: SupabaseClient,
  user: { id: string; email?: string | null },
  threadId: string,
  body: { pin?: unknown; password?: unknown }
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const pinHash = await getThreadLockPinHash(serviceClient, user.id, threadId)
  const pin = typeof body.pin === 'string' ? body.pin.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (pin) {
    if (!pinHash) {
      return { ok: false, response: forbiddenResponse('This chat does not have a PIN yet') }
    }
    if (!isValidChatLockPin(pin) || !verifyChatLockPin(pin, pinHash)) {
      return { ok: false, response: forbiddenResponse('Incorrect PIN for this chat') }
    }
    return { ok: true }
  }

  if (password) {
    const valid = await verifyAccountPassword(user.email ?? undefined, password)
    if (!valid) {
      return { ok: false, response: forbiddenResponse('Incorrect password') }
    }
    return { ok: true }
  }

  return { ok: false, response: errorResponse('PIN or account password is required', 400) }
}
