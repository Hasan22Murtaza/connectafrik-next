import type { SupabaseClient } from '@supabase/supabase-js'
import { canMessage } from './access'
import type { PrivacyDecision } from './types'

export async function assertCanMessageThread(
  serviceClient: SupabaseClient,
  senderId: string,
  threadId: string
): Promise<PrivacyDecision> {
  const { data: thread } = await serviceClient
    .from('chat_threads')
    .select('id, type, group_id, product_id')
    .eq('id', threadId)
    .maybeSingle()

  if (!thread) return { allowed: true }
  if (thread.type === 'marketplace' || thread.product_id || thread.group_id) {
    return { allowed: true }
  }

  const { data: parts } = await serviceClient
    .from('chat_participants')
    .select('user_id')
    .eq('thread_id', threadId)

  const others = (parts || [])
    .map((p: { user_id: string }) => p.user_id)
    .filter((id: string) => id !== senderId)

  for (const otherId of others) {
    const decision = await canMessage(senderId, otherId, serviceClient)
    if (!decision.allowed) return decision
  }
  return { allowed: true }
}

export async function assertCanCallThread(
  serviceClient: SupabaseClient,
  callerId: string,
  threadId: string,
  isGroupCall: boolean
): Promise<PrivacyDecision> {
  const { canCall } = await import('./access')
  const { data: thread } = await serviceClient
    .from('chat_threads')
    .select('id, type, group_id')
    .eq('id', threadId)
    .maybeSingle()

  const { data: parts } = await serviceClient
    .from('chat_participants')
    .select('user_id')
    .eq('thread_id', threadId)

  const others = (parts || [])
    .map((p: { user_id: string }) => p.user_id)
    .filter((id: string) => id !== callerId)

  const groupCall = isGroupCall || thread?.type === 'group' || Boolean(thread?.group_id)
  for (const otherId of others) {
    const decision = await canCall(callerId, otherId, { isGroupCall: groupCall, client: serviceClient })
    if (!decision.allowed) return decision
  }
  return { allowed: true }
}
