import { createServiceClient } from '@/lib/supabase-server'
import { notifyIfAllowed } from './deliver'
import type { NotificationType } from '@/shared/types/notifications'

const MENTION_RE = /(?:^|[\s([{])@([A-Za-z][A-Za-z0-9._]{1,31})\b/g

export function extractMentionUsernames(text: string | null | undefined): string[] {
  if (!text) return []
  const found = new Set<string>()
  for (const match of text.matchAll(MENTION_RE)) {
    const username = match[1]?.trim()
    if (username) found.add(username)
  }
  return [...found]
}

export async function notifyMentionedUsers(params: {
  text: string | null | undefined
  actorId: string
  actorName: string
  accessToken?: string | null
  data: Record<string, unknown> & { url?: string }
}): Promise<void> {
  const usernames = extractMentionUsernames(params.text)
  if (usernames.length === 0) return

  const db = createServiceClient()
  const orFilter = usernames
    .map((name) => `username.ilike."${name.replace(/"/g, '')}"`)
    .join(',')
  const { data: profiles } = await db
    .from('profiles')
    .select('id, username')
    .or(orFilter)

  const recipientIds = [...new Set(
    (profiles || [])
      .map((row) => row.id as string)
      .filter((id) => id && id !== params.actorId)
  )]
  if (recipientIds.length === 0) return

  const type: NotificationType = 'mention'
  await Promise.allSettled(
    recipientIds.map((recipientId) =>
      notifyIfAllowed({
        recipientId,
        actorId: params.actorId,
        type,
        title: 'You were mentioned',
        message: `${params.actorName} mentioned you`,
        accessToken: params.accessToken,
        data: {
          ...params.data,
          type,
          url: params.data.url || '/feed',
        },
      })
    )
  )
}
