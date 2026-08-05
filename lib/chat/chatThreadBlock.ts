import { createServiceClient } from '@/lib/supabase-server'

export type ThreadBlockState = {
  blockedByMe: boolean
  blockedByOther: boolean
}

/** Whether the current user blocked others, or was blocked by another participant in this thread. */
export async function getThreadBlockState(
  serviceClient: ReturnType<typeof createServiceClient>,
  threadId: string,
  userId: string
): Promise<ThreadBlockState> {
  const { data: rows } = await serviceClient
    .from('chat_participants')
    .select('user_id, is_block')
    .eq('thread_id', threadId)

  let blockedByMe = false
  let blockedByOther = false
  for (const row of rows ?? []) {
    if (row.user_id === userId) {
      blockedByMe = Boolean(row.is_block)
    } else if (row.is_block) {
      blockedByOther = true
    }
  }
  return { blockedByMe, blockedByOther }
}

export function blockStateErrorMessage(state: ThreadBlockState): string | null {
  if (state.blockedByMe) return 'You have blocked this contact'
  if (state.blockedByOther) return 'This contact has blocked you'
  return null
}

/** Batch block state for thread list endpoints. */
export async function getBlockStatesForThreads(
  serviceClient: ReturnType<typeof createServiceClient>,
  userId: string,
  threadIds: string[]
): Promise<Map<string, ThreadBlockState>> {
  const result = new Map<string, ThreadBlockState>()
  if (threadIds.length === 0) return result

  const { data: rows } = await serviceClient
    .from('chat_participants')
    .select('thread_id, user_id, is_block')
    .in('thread_id', threadIds)

  const byThread = new Map<string, Array<{ user_id: string; is_block: boolean }>>()
  for (const row of rows ?? []) {
    const tid = row.thread_id as string
    const list = byThread.get(tid) ?? []
    list.push({ user_id: row.user_id as string, is_block: Boolean(row.is_block) })
    byThread.set(tid, list)
  }

  for (const threadId of threadIds) {
    const participants = byThread.get(threadId) ?? []
    let blockedByMe = false
    let blockedByOther = false
    for (const p of participants) {
      if (p.user_id === userId) blockedByMe = p.is_block
      else if (p.is_block) blockedByOther = true
    }
    result.set(threadId, { blockedByMe, blockedByOther })
  }
  return result
}
