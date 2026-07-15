import type { SupabaseClient } from '@supabase/supabase-js'
import { GROUP_MEMBER_JOINED, GROUP_MEMBER_LEFT } from '@/lib/groupChatSystemMessages'
import { MARKETPLACE_SYSTEM } from '@/lib/marketplaceChat'
import { deepseekChatCompletion } from '@/lib/deepseek'

const MESSAGE_BATCH_SIZE = 200
const MAX_MESSAGES_FOR_TRANSCRIPT = 800
const MAX_DIALOGUE_CHARS = 80_000

const EXCLUDED_MESSAGE_TYPES = new Set([
  'initiated',
  'ringing',
  'active',
  'declined',
  'ended',
  'missed',
  'failed',
  'call_notification',
  'hand_raised',
  'reaction',
  'screen_share_started',
  'screen_share_stopped',
  GROUP_MEMBER_JOINED,
  GROUP_MEMBER_LEFT,
  MARKETPLACE_SYSTEM,
])

export type ChatTranscriptRow = {
  id: string
  thread_id: string
  generated_by: string
  content: string
  source_message_count: number
  source_last_message_at: string | null
  model: string | null
  created_at: string
  updated_at: string
}

type SenderProfile = {
  id: string
  username: string | null
  full_name: string | null
}

type RawMessage = {
  id: string
  content: string | null
  created_at: string
  message_type: string | null
  is_deleted: boolean | null
  deleted_for: string[] | null
  metadata: Record<string, unknown> | null
  sender: SenderProfile | SenderProfile[] | null
}

function normalizeSender(
  sender: RawMessage['sender']
): SenderProfile | null {
  if (!sender) return null
  return Array.isArray(sender) ? sender[0] ?? null : sender
}

function stripHtml(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function senderLabel(message: RawMessage): string {
  const sender = normalizeSender(message.sender)
  if (!sender) return 'Unknown'
  return (sender.full_name || sender.username || 'Unknown').trim() || 'Unknown'
}

function formatMessageLine(message: RawMessage): string | null {
  if (message.is_deleted) return null
  const type = (message.message_type || 'text').toLowerCase()
  if (EXCLUDED_MESSAGE_TYPES.has(type)) return null

  const when = new Date(message.created_at)
  const stamp = Number.isFinite(when.getTime())
    ? when.toISOString().replace('T', ' ').slice(0, 16)
    : message.created_at

  const name = senderLabel(message)
  const text = stripHtml(message.content || '')

  if (type === 'location') {
    return `[${stamp}] ${name}: [Shared a location]`
  }
  if (type === 'image' || type === 'video' || type === 'file' || type === 'audio') {
    const label = text || `[Shared a ${type}]`
    return `[${stamp}] ${name}: ${label}`
  }
  if (!text) return null
  return `[${stamp}] ${name}: ${text}`
}

export async function fetchThreadDialogueForTranscript(
  serviceClient: SupabaseClient,
  threadId: string,
  viewerUserId: string
): Promise<{ lines: string[]; messageCount: number; lastMessageAt: string | null }> {
  const lines: string[] = []
  let messageCount = 0
  let lastMessageAt: string | null = null
  let offset = 0

  while (messageCount < MAX_MESSAGES_FOR_TRANSCRIPT) {
    const limit = Math.min(MESSAGE_BATCH_SIZE, MAX_MESSAGES_FOR_TRANSCRIPT - messageCount)
    const { data, error } = await serviceClient
      .from('chat_messages')
      .select(
        `
        id,
        content,
        created_at,
        message_type,
        is_deleted,
        deleted_for,
        metadata,
        sender:profiles!chat_messages_sender_id_fkey(id, username, full_name)
      `
      )
      .eq('thread_id', threadId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      throw new Error(error.message || 'Failed to load chat messages')
    }

    const batch = (data || []) as unknown as RawMessage[]
    if (batch.length === 0) break

    for (const message of batch) {
      const deletedFor = Array.isArray(message.deleted_for) ? message.deleted_for : []
      if (deletedFor.includes(viewerUserId)) continue

      const line = formatMessageLine(message)
      if (!line) continue

      lines.push(line)
      messageCount += 1
      lastMessageAt = message.created_at
    }

    offset += batch.length
    if (batch.length < limit) break
  }

  return { lines, messageCount, lastMessageAt }
}

export async function generateTranscriptWithDeepSeek(
  dialogueLines: string[]
): Promise<{ content: string; model: string }> {
  const dialogue = dialogueLines.join('\n')
  const truncated =
    dialogue.length > MAX_DIALOGUE_CHARS
      ? `${dialogue.slice(0, MAX_DIALOGUE_CHARS)}\n\n[…earlier messages truncated…]`
      : dialogue

  return deepseekChatCompletion(
    [
      {
        role: 'system',
        content:
          'You turn chat conversations into clear, readable transcripts. ' +
          'Preserve the flow and who said what. Produce: (1) a short Summary (2–4 sentences), ' +
          'then (2) a Transcript section rewriting the dialogue in clean prose or dated speaker lines. ' +
          'Omit call/system noise. Do not invent facts. Use the conversation language(s) as written.',
      },
      {
        role: 'user',
        content:
          'Create a readable transcript/summary of this chat conversation:\n\n' + truncated,
      },
    ],
    { temperature: 0.3, maxTokens: 4096 }
  )
}

export async function getSavedTranscript(
  serviceClient: SupabaseClient,
  threadId: string
): Promise<ChatTranscriptRow | null> {
  const { data, error } = await serviceClient
    .from('chat_transcripts')
    .select('*')
    .eq('thread_id', threadId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load transcript')
  }
  return (data as ChatTranscriptRow | null) ?? null
}

export async function upsertTranscript(
  serviceClient: SupabaseClient,
  payload: {
    threadId: string
    userId: string
    content: string
    sourceMessageCount: number
    sourceLastMessageAt: string | null
    model: string
  }
): Promise<ChatTranscriptRow> {
  const now = new Date().toISOString()
  const { data, error } = await serviceClient
    .from('chat_transcripts')
    .upsert(
      {
        thread_id: payload.threadId,
        generated_by: payload.userId,
        content: payload.content,
        source_message_count: payload.sourceMessageCount,
        source_last_message_at: payload.sourceLastMessageAt,
        model: payload.model,
        updated_at: now,
      },
      { onConflict: 'thread_id' }
    )
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save transcript')
  }
  return data as ChatTranscriptRow
}
