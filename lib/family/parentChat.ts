import type { SupabaseClient } from '@supabase/supabase-js'
import { getActiveMembership, isManagedRole } from './auth'

/**
 * Active parent user ids in the same family as a managed child/teen.
 * Empty when the user is not a managed child/teen.
 */
export async function getFamilyParentUserIds(
  supabase: SupabaseClient,
  childUserId: string
): Promise<Set<string>> {
  if (!childUserId) return new Set()

  const membership = await getActiveMembership(supabase, childUserId)
  if (!membership || !isManagedRole(membership.role)) return new Set()

  const { data, error } = await supabase
    .from('family_members')
    .select('user_id')
    .eq('family_id', membership.family_id)
    .eq('role', 'parent')
    .eq('status', 'active')

  if (error) throw new Error(error.message)
  return new Set(
    (data || [])
      .map((row) => (typeof row.user_id === 'string' ? row.user_id : ''))
      .filter(Boolean)
  )
}

/**
 * True when the current user is a managed child/teen and `otherUserId` is an
 * active parent in the same family. Used so parental messaging/call locks do
 * not block child ↔ parent contact.
 */
export async function isUserFamilyParentOf(
  supabase: SupabaseClient,
  childUserId: string,
  otherUserId: string
): Promise<boolean> {
  if (!childUserId || !otherUserId || childUserId === otherUserId) return false
  const parents = await getFamilyParentUserIds(supabase, childUserId)
  return parents.has(otherUserId)
}

/**
 * True for 1:1 threads where the other participant is a family parent of the
 * current (managed) user. Groups always return false.
 */
export async function isThreadWithFamilyParent(
  supabase: SupabaseClient,
  userId: string,
  threadId: string
): Promise<boolean> {
  const { data: thread, error: threadError } = await supabase
    .from('chat_threads')
    .select('id, type, group_id')
    .eq('id', threadId)
    .maybeSingle()

  if (threadError) throw new Error(threadError.message)
  if (!thread) return false
  if (thread.type === 'group' || thread.group_id) return false

  const { data: participants, error: participantsError } = await supabase
    .from('chat_participants')
    .select('user_id')
    .eq('thread_id', threadId)

  if (participantsError) throw new Error(participantsError.message)

  const otherIds = (participants || [])
    .map((row) => (typeof row.user_id === 'string' ? row.user_id : ''))
    .filter((id) => id && id !== userId)

  if (otherIds.length !== 1) return false
  return isUserFamilyParentOf(supabase, userId, otherIds[0])
}
