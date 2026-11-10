import type { SupabaseClient } from '@supabase/supabase-js'

/** Stored on `chat_messages.message_type`; UI renders a centered system line. */
export const DISAPPEARING_MESSAGES = 'disappearing_messages'

export const DISAPPEARING_DURATION_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 24 * 60 * 60, label: '24 hours' },
  { value: 7 * 24 * 60 * 60, label: '7 days' },
  { value: 90 * 24 * 60 * 60, label: '90 days' },
] as const

export type DisappearingDurationSec =
  (typeof DISAPPEARING_DURATION_OPTIONS)[number]['value']

const ALLOWED = new Set<number>(
  DISAPPEARING_DURATION_OPTIONS.map((o) => o.value).filter((v) => v > 0)
)

export function isDisappearingMessagesType(t: string | undefined): boolean {
  return t === DISAPPEARING_MESSAGES
}

export function normalizeDisappearingDurationSec(
  raw: unknown
): number | null {
  if (raw === null || raw === undefined || raw === '' || raw === 0 || raw === '0') {
    return null
  }
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || !ALLOWED.has(n)) return null
  return n
}

export function disappearingDurationLabel(sec: number | null | undefined): string {
  if (!sec) return 'Off'
  const match = DISAPPEARING_DURATION_OPTIONS.find((o) => o.value === sec)
  return match?.label ?? 'Off'
}

export function computeMessageExpiresAt(
  durationSec: number | null | undefined,
  from: Date = new Date()
): string | null {
  const sec = normalizeDisappearingDurationSec(durationSec)
  if (!sec) return null
  return new Date(from.getTime() + sec * 1000).toISOString()
}

export function formatDisappearingSystemContent(params: {
  actorName: string
  durationSec: number | null
}): string {
  const who = params.actorName.trim() || 'Someone'
  if (!params.durationSec) {
    return `${who} turned off disappearing messages.`
  }
  const label = disappearingDurationLabel(params.durationSec)
  return `${who} turned on disappearing messages. New messages will disappear ${label} after they are sent.`
}

export function disappearingSystemContentForViewer(params: {
  actorName?: string | null
  durationSec: number | null
  isOwnMessage: boolean
}): string {
  const who = params.isOwnMessage
    ? 'You'
    : (params.actorName?.trim() || 'Someone')
  return formatDisappearingSystemContent({
    actorName: who,
    durationSec: params.durationSec,
  })
}

export async function insertDisappearingSystemMessage(
  serviceClient: SupabaseClient,
  params: {
    threadId: string
    actorUserId: string
    durationSec: number | null
  }
): Promise<{
  id: string
  thread_id: string
  sender_id: string
  content: string
  created_at: string
  updated_at?: string
  message_type: string
  metadata: Record<string, unknown>
  is_deleted: boolean
} | null> {
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('full_name, username')
    .eq('id', params.actorUserId)
    .maybeSingle()

  const displayName =
    (profile as { full_name?: string | null; username?: string | null } | null)?.full_name?.trim() ||
    (profile as { full_name?: string | null; username?: string | null } | null)?.username?.trim() ||
    'Someone'

  const content = formatDisappearingSystemContent({
    actorName: displayName,
    durationSec: params.durationSec,
  })
  const now = new Date().toISOString()

  const { data: message, error } = await serviceClient
    .from('chat_messages')
    .insert({
      thread_id: params.threadId,
      sender_id: params.actorUserId,
      content,
      message_type: DISAPPEARING_MESSAGES,
      metadata: {
        disappearing_duration_sec: params.durationSec,
        event: params.durationSec ? 'on' : 'off',
        actor_name: displayName,
      },
    })
    .select(
      'id, thread_id, sender_id, content, created_at, updated_at, message_type, metadata, is_deleted'
    )
    .single()

  if (error || !message) {
    console.error('insertDisappearingSystemMessage:', error)
    return null
  }

  await serviceClient
    .from('chat_threads')
    .update({
      last_message_preview: content,
      last_message_at: now,
      last_activity_at: now,
      updated_at: now,
    })
    .eq('id', params.threadId)

  await serviceClient.from('message_reads').insert({
    message_id: message.id,
    user_id: params.actorUserId,
  })

  const { error: bumpErr } = await serviceClient.rpc('chat_bump_unread_for_recipients', {
    p_thread_id: params.threadId,
    p_sender_id: params.actorUserId,
  })
  if (bumpErr) console.error('chat_bump_unread_for_recipients (disappearing)', bumpErr)

  return message as {
    id: string
    thread_id: string
    sender_id: string
    content: string
    created_at: string
    updated_at?: string
    message_type: string
    metadata: Record<string, unknown>
    is_deleted: boolean
  }
}

/** Soft-delete expired rows for a thread (opportunistic, before list/send). */
export async function purgeExpiredMessagesForThread(
  serviceClient: SupabaseClient,
  threadId: string
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await serviceClient
    .from('chat_messages')
    .update({
      is_deleted: true,
      content: '',
      deleted_at: now,
      updated_at: now,
    })
    .eq('thread_id', threadId)
    .eq('is_deleted', false)
    .not('expires_at', 'is', null)
    .lte('expires_at', now)

  if (error) {
    console.error('purgeExpiredMessagesForThread:', error)
  }
}
