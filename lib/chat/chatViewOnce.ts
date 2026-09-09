import jwt from 'jsonwebtoken'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deleteFromBunny, fetchFromBunny } from '@/lib/bunny'

export const VIEW_ONCE_ALREADY_OPENED = 'VIEW_ONCE_ALREADY_OPENED'
export const VIEW_ONCE_FORBIDDEN = 'VIEW_ONCE_FORBIDDEN'
export const VIEW_ONCE_SESSION_TTL_SEC = 10 * 60
export const VIEW_ONCE_RECLAIM_MS = 30 * 1000

type ViewOnceTokenPayload = {
  sub: string
  purpose: 'chat_view_once'
  message_id: string
  thread_id: string
}

export type ViewOnceAttachmentInput = {
  name?: string
  file_name?: string
  mimeType?: string
  file_type?: string
  url?: string
  file_url?: string
}

export type ViewOnceKind = 'photo' | 'video'

function getViewOnceSecret(): string {
  return (
    process.env.CHAT_VIEW_ONCE_SECRET ||
    process.env.CHAT_LOCK_SECRET ||
    process.env.AUTH_OTP_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'connectafrik-view-once-dev'
  )
}

export function isGifMimeOrName(mime?: string | null, name?: string | null): boolean {
  const m = (mime || '').toLowerCase()
  const n = (name || '').toLowerCase()
  return m === 'image/gif' || n.endsWith('.gif')
}

export function isViewOnceEligibleMime(mime?: string | null, name?: string | null): boolean {
  const m = (mime || '').toLowerCase()
  if (isGifMimeOrName(m, name)) return false
  if (m.startsWith('audio/')) return false
  return m.startsWith('image/') || m.startsWith('video/')
}

export function attachmentsAreViewOnceEligible(attachments: ViewOnceAttachmentInput[]): boolean {
  if (!attachments.length) return false
  return attachments.every((a) =>
    isViewOnceEligibleMime(a.mimeType || a.file_type, a.name || a.file_name)
  )
}

export function detectViewOnceKind(attachments: ViewOnceAttachmentInput[]): ViewOnceKind {
  const hasVideo = attachments.some((a) =>
    (a.mimeType || a.file_type || '').toLowerCase().startsWith('video/')
  )
  return hasVideo ? 'video' : 'photo'
}

export function viewOnceThreadPreview(kind: ViewOnceKind, opened: boolean): string {
  if (opened) return kind === 'video' ? 'Opened video' : 'Opened photo'
  return kind === 'video' ? '🎥 Video' : '📷 Photo'
}

export function viewOncePushBody(kind: ViewOnceKind): string {
  return kind === 'video' ? 'New video' : 'New photo'
}

export function stripViewOnceAttachmentUrls<T extends Record<string, unknown>>(attachments: T[]): T[] {
  return attachments.map((a) => {
    const next: Record<string, unknown> = { ...a }
    if ('file_url' in next) next.file_url = ''
    if ('url' in next) next.url = ''
    if ('thumbnail_url' in next) next.thumbnail_url = ''
    return next as T
  })
}

export function sanitizeViewOnceMessage<T extends Record<string, unknown>>(message: T): T {
  if (!message || message.view_once !== true) return message
  const attachments = Array.isArray(message.attachments)
    ? stripViewOnceAttachmentUrls(message.attachments as Record<string, unknown>[])
    : message.attachments
  return { ...message, attachments }
}

export function createViewOnceToken(
  userId: string,
  threadId: string,
  messageId: string
): string {
  return jwt.sign(
    {
      sub: userId,
      purpose: 'chat_view_once',
      message_id: messageId,
      thread_id: threadId,
    } satisfies ViewOnceTokenPayload,
    getViewOnceSecret(),
    { expiresIn: VIEW_ONCE_SESSION_TTL_SEC }
  )
}

export function verifyViewOnceToken(
  token: string,
  userId: string,
  threadId: string,
  messageId: string
): boolean {
  try {
    const payload = jwt.verify(token, getViewOnceSecret()) as ViewOnceTokenPayload
    return (
      payload.purpose === 'chat_view_once' &&
      payload.sub === userId &&
      payload.thread_id === threadId &&
      payload.message_id === messageId
    )
  } catch {
    return false
  }
}

export function publicViewOnceAttachments(
  rows: { id: string; file_name?: string; file_size?: number; file_type?: string }[]
) {
  return rows.map((a) => {
    const mime = a.file_type || ''
    const type = mime.startsWith('image/')
      ? 'image'
      : mime.startsWith('video/')
        ? 'video'
        : 'file'
    return {
      id: a.id,
      name: a.file_name || 'media',
      size: a.file_size || 0,
      mimeType: mime,
      type,
    }
  })
}

export async function updateThreadPreviewIfLatest(
  serviceClient: SupabaseClient,
  threadId: string,
  messageCreatedAt: string,
  preview: string
): Promise<void> {
  const { data: thread } = await serviceClient
    .from('chat_threads')
    .select('last_message_at')
    .eq('id', threadId)
    .maybeSingle()

  const lastAt = thread?.last_message_at ? new Date(thread.last_message_at).getTime() : 0
  const msgAt = new Date(messageCreatedAt).getTime()
  if (!Number.isFinite(msgAt)) return
  if (lastAt && Number.isFinite(lastAt) && msgAt + 2000 < lastAt) return

  const now = new Date().toISOString()
  await serviceClient
    .from('chat_threads')
    .update({
      last_message_preview: preview,
      updated_at: now,
    })
    .eq('id', threadId)
}

export async function consumeViewOnceStorage(
  serviceClient: SupabaseClient,
  messageId: string
): Promise<void> {
  const { data: rows } = await serviceClient
    .from('message_attachments')
    .select('id, file_url')
    .eq('message_id', messageId)

  for (const row of rows || []) {
    const url = String(row.file_url || '').trim()
    if (!url) continue
    try {
      await deleteFromBunny(url)
    } catch (error) {
      console.error('View once Bunny delete failed', messageId, row.id, error)
      throw error
    }
  }

  if ((rows || []).length > 0) {
    await serviceClient
      .from('message_attachments')
      .update({ file_url: '' })
      .eq('message_id', messageId)
  }
}

export async function loadViewOnceAttachmentBytes(
  serviceClient: SupabaseClient,
  messageId: string,
  attachmentId: string
): Promise<{ body: Buffer; contentType: string; fileName: string } | null> {
  const { data: row } = await serviceClient
    .from('message_attachments')
    .select('id, file_url, file_type, file_name')
    .eq('id', attachmentId)
    .eq('message_id', messageId)
    .maybeSingle()

  const url = String(row?.file_url || '').trim()
  if (!row || !url) return null

  const fetched = await fetchFromBunny(url)
  return {
    body: fetched.body,
    contentType: row.file_type || fetched.contentType || 'application/octet-stream',
    fileName: row.file_name || 'media',
  }
}
