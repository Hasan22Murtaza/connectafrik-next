import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase-server'

function tryServiceClient(): SupabaseClient | null {
  try {
    return createServiceClient()
  } catch {
    return null
  }
}

async function lookupGroupChatThreadIdWithClient(
  client: SupabaseClient,
  groupId: string
): Promise<string | null> {
  const { data } = await client
    .from('chat_threads')
    .select('id')
    .eq('type', 'group')
    .eq('group_id', groupId)
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

export async function lookupGroupChatThreadId(groupId: string): Promise<string | null> {
  const client = tryServiceClient()
  if (!client) return null
  return lookupGroupChatThreadIdWithClient(client, groupId)
}

export async function lookupGroupChatThreadIds(groupIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (groupIds.length === 0) return map
  const client = tryServiceClient()
  if (!client) return map
  const { data } = await client
    .from('chat_threads')
    .select('id, group_id')
    .eq('type', 'group')
    .in('group_id', groupIds)
  for (const row of data || []) {
    const r = row as { id: string; group_id: string | null }
    if (r.group_id && r.id && !map.has(r.group_id)) {
      map.set(r.group_id, r.id)
    }
  }
  return map
}

export async function lookupDirectThreadIdBetweenUsers(
  userIdA: string,
  userIdB: string
): Promise<string | null> {
  const client = tryServiceClient()
  if (!client) return null
  const { data: aParts } = await client.from('chat_participants').select('thread_id').eq('user_id', userIdA)
  const setA = new Set((aParts || []).map((p: { thread_id: string }) => p.thread_id))
  if (setA.size === 0) return null
  const { data: bParts } = await client.from('chat_participants').select('thread_id').eq('user_id', userIdB)
  const common = (bParts || [])
    .map((p: { thread_id: string }) => p.thread_id)
    .filter((tid: string) => setA.has(tid))
  if (common.length === 0) return null
  const { data: rows } = await client
    .from('chat_threads')
    .select('id')
    .eq('type', 'direct')
    .in('id', common)
    .limit(1)
  return rows?.[0]?.id ?? null
}
