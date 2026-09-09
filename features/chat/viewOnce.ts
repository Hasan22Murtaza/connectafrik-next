import type { ChatAttachment, ChatMessage } from '@/features/chat/services/supabaseMessagingService'

export type ViewOnceKind = 'photo' | 'video'

export function isViewOnceMessage(
  message: Pick<ChatMessage, 'view_once' | 'metadata'> | null | undefined
): boolean {
  if (!message) return false
  if (message.view_once) return true
  const meta = message.metadata
  return Boolean(meta && (meta as Record<string, unknown>).view_once === true)
}

export function viewOnceKindFromAttachments(
  attachments: ChatAttachment[] | null | undefined
): ViewOnceKind {
  if ((attachments || []).some((a) => a.type === 'video' || (a.mimeType || '').startsWith('video/'))) {
    return 'video'
  }
  return 'photo'
}

export function viewOnceKindFromMessage(
  message: Pick<ChatMessage, 'attachments' | 'metadata'> | null | undefined
): ViewOnceKind {
  if ((message?.attachments || []).some((a) => a.type === 'video' || (a.mimeType || '').startsWith('video/'))) {
    return 'video'
  }
  const kind = message?.metadata && (message.metadata as Record<string, unknown>).view_once_kind
  return kind === 'video' ? 'video' : 'photo'
}

export function isViewOnceEligibleAttachment(att: Pick<ChatAttachment, 'type' | 'mimeType' | 'name'>): boolean {
  const mime = (att.mimeType || '').toLowerCase()
  const name = (att.name || '').toLowerCase()
  if (mime === 'image/gif' || name.endsWith('.gif')) return false
  if (att.type === 'image' || mime.startsWith('image/')) return true
  if (att.type === 'video' || mime.startsWith('video/')) return true
  return false
}

export function canEnableViewOnce(files: Pick<ChatAttachment, 'type' | 'mimeType' | 'name'>[]): boolean {
  if (!files.length) return false
  return files.every(isViewOnceEligibleAttachment)
}

export function viewOnceBubbleLabel(
  kind: ViewOnceKind,
  opened: boolean,
  isOwnMessage: boolean
): string {
  if (opened) {
    if (isOwnMessage) return 'Opened'
    return kind === 'video' ? 'Opened video' : 'Opened photo'
  }
  return kind === 'video' ? 'Video · View once' : 'Photo · View once'
}
