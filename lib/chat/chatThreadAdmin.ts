import type { SupabaseClient } from '@supabase/supabase-js'

const CHAT_ADMIN_ROLES = new Set(['admin', 'co_admin'])
const GROUP_ADMIN_ROLES = new Set(['admin', 'co_admin', 'manager'])

export function isChatAdminRole(role: string | null | undefined): boolean {
  return CHAT_ADMIN_ROLES.has((role || '').toLowerCase())
}

export function formatChatParticipantRoleLabel(role: string | null | undefined): string {
  const r = (role || 'member').toLowerCase()
  if (r === 'admin') return 'Admin'
  if (r === 'co_admin') return 'Co-admin'
  if (r === 'manager') return 'Manager'
  return 'Member'
}

/**
 * True when the user can manage chat group members (add/remove).
 * Uses `chat_participants.role`, with a fallback to social `group_memberships`
 * when the thread is linked to a community group.
 */
export async function isChatThreadAdmin(
  serviceClient: SupabaseClient,
  userId: string,
  threadId: string
): Promise<boolean> {
  const { data: participant, error: partErr } = await serviceClient
    .from('chat_participants')
    .select('role')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .maybeSingle()

  if (partErr) throw partErr
  if (!participant) return false
  if (isChatAdminRole(participant.role)) return true

  const { data: thread, error: threadErr } = await serviceClient
    .from('chat_threads')
    .select('group_id')
    .eq('id', threadId)
    .maybeSingle()

  if (threadErr) throw threadErr
  const groupId =
    typeof thread?.group_id === 'string' && thread.group_id.trim()
      ? thread.group_id.trim()
      : null
  if (!groupId) return false

  const { data: membership, error: memErr } = await serviceClient
    .from('group_memberships')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (memErr) throw memErr
  return GROUP_ADMIN_ROLES.has((membership?.role || '').toLowerCase())
}
