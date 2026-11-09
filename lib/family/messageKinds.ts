export type ParentalMessageKind = 'text' | 'image' | 'video' | 'audio' | 'emergency' | 'other'

type AttachmentLike = {
  mimeType?: string | null
  type?: string | null
  name?: string | null
}

function attachmentIsAudio(a: AttachmentLike): boolean {
  const mime = (a.mimeType || '').toLowerCase()
  const type = (a.type || '').toLowerCase()
  const name = (a.name || '').toLowerCase()
  if (type === 'audio' || type === 'voice') return true
  if (mime.startsWith('audio/')) return true
  if (name.startsWith('voice-') || name.includes('.webm') || name.includes('.ogg') || name.includes('.m4a')) {
    if (mime.startsWith('video/')) return false
    return mime.startsWith('audio/') || type === 'file' || !mime
  }
  return false
}

function attachmentIsVideo(a: AttachmentLike): boolean {
  const mime = (a.mimeType || '').toLowerCase()
  const type = (a.type || '').toLowerCase()
  if (type === 'video') return true
  return mime.startsWith('video/')
}

function attachmentIsImage(a: AttachmentLike): boolean {
  const mime = (a.mimeType || '').toLowerCase()
  const type = (a.type || '').toLowerCase()
  if (type === 'image' || type === 'photo') return true
  return mime.startsWith('image/')
}

/** Infer parental message kind from payload (attachments win over bare text). */
export function resolveParentalMessageKind(input: {
  message_type?: string | null
  content?: string | null
  attachments?: AttachmentLike[] | null
  metadata?: Record<string, unknown> | null
}): ParentalMessageKind {
  const meta = input.metadata && typeof input.metadata === 'object' ? input.metadata : null
  const rawType = (input.message_type || '').toLowerCase().trim()

  if (meta?.emergency === true || rawType === 'emergency') {
    return 'emergency'
  }

  const attachments = Array.isArray(input.attachments) ? input.attachments : []
  if (attachments.length > 0) {
    if (attachments.some(attachmentIsAudio) || rawType === 'audio' || rawType === 'voice') {
      return 'audio'
    }
    if (attachments.some(attachmentIsVideo)) return 'video'
    if (attachments.some(attachmentIsImage)) return 'image'
    // Documents / other files fall under "other" (gated by text + messaging master)
    return 'other'
  }

  if (rawType === 'audio' || rawType === 'voice') return 'audio'
  if (rawType === 'video') return 'video'
  if (rawType === 'image' || rawType === 'photo') return 'image'
  if (rawType === 'location' || rawType === 'text' || !rawType) return 'text'
  return 'other'
}
