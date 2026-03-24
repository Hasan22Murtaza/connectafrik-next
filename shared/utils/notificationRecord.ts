import type { NotificationType } from '@/shared/types/notifications'

/**
 * DB rows differ: some use `data`, some `payload`, some `metadata` (json blobs).
 */
export function getNotificationPayload(record: { payload?: unknown; data?: unknown; metadata?: unknown }): Record<string, unknown> {
  const raw = record?.payload ?? record?.data ?? record?.metadata
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  return {}
}

/** Prefer signal type stored inside JSON (e.g. ringing) when top-level type is system. */
export function getNotificationTypeSource(record: { type?: string }, payload: Record<string, unknown>): string {
  const embedded = typeof payload.type === 'string' ? payload.type.trim() : ''
  return embedded || String(record?.type || '').trim()
}

/** DB may store pre–call_sessions labels or `system` with real type in JSON. */
/** Remove leading emoji / pictographs so titles stay plain text (icons render separately in UI). */
export function stripLeadingEmoji(text: string): string {
  if (!text) return text
  const trimmed = text.trim()
  const re = /^[\s\p{Extended_Pictographic}\uFE0F\u200D]+/gu
  const next = trimmed.replace(re, '').trim()
  return next.length > 0 ? next : text
}

export function normalizeNotificationType(raw: string): NotificationType {
  return raw as NotificationType
}
