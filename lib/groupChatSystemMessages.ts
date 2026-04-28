import type { SupabaseClient } from '@supabase/supabase-js'

/** Stored on `chat_messages.message_type`; UI renders centered like call/system lines */
export const GROUP_MEMBER_JOINED = 'group_member_joined'
export const GROUP_MEMBER_LEFT = 'group_member_left'

export function isGroupMemberSystemMessageType(t: string | undefined): boolean {
  return t === GROUP_MEMBER_JOINED || t === GROUP_MEMBER_LEFT
}

export async function ensureChatParticipantsForThread(
  serviceClient: SupabaseClient,
  threadId: string,
  userIds: string[]
): Promise<void> {
  const unique = [...new Set(userIds)].filter(Boolean)
  if (unique.length === 0) return

  const { data: existing, error: selErr } = await serviceClient
    .from('chat_participants')
    .select('user_id')
    .eq('thread_id', threadId)
    .in('user_id', unique)

  if (selErr) throw selErr

  const have = new Set((existing || []).map((r: { user_id: string }) => r.user_id))
  const missing = unique.filter((id) => !have.has(id))
  if (missing.length === 0) return

  const { error: insErr } = await serviceClient.from('chat_participants').insert(
    missing.map((user_id) => ({
      thread_id: threadId,
      user_id,
      role: 'member',
    }))
  )

  if (insErr) throw insErr
}

export async function insertGroupMembershipSystemMessage(
  serviceClient: SupabaseClient,
  params: { threadId: string; subjectUserId: string; kind: 'joined' | 'left' }
): Promise<{ id: string } | null> {
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('full_name, username')
    .eq('id', params.subjectUserId)
    .maybeSingle()

  const displayName =
    (profile as { full_name?: string | null; username?: string | null } | null)?.full_name?.trim() ||
    (profile as { full_name?: string | null; username?: string | null } | null)?.username?.trim() ||
    'Someone'

  const content =
    params.kind === 'joined'
      ? `${displayName} joined the group`
      : `${displayName} left the group`

  const now = new Date().toISOString()
  const message_type = params.kind === 'joined' ? GROUP_MEMBER_JOINED : GROUP_MEMBER_LEFT

  const { data: message, error } = await serviceClient
    .from('chat_messages')
    .insert({
      thread_id: params.threadId,
      sender_id: params.subjectUserId,
      content,
      message_type,
      metadata: { group_event: params.kind },
    })
    .select('id')
    .single()

  if (error || !message) {
    console.error('insertGroupMembershipSystemMessage:', error)
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
    user_id: params.subjectUserId,
  })

  return { id: message.id }
}

export async function removeChatParticipantFromThread(
  serviceClient: SupabaseClient,
  threadId: string,
  userId: string
): Promise<void> {
  const { error } = await serviceClient
    .from('chat_participants')
    .delete()
    .eq('thread_id', threadId)
    .eq('user_id', userId)

  if (error) throw error
}
