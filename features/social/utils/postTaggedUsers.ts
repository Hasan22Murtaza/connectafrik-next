import type { SupabaseClient } from '@supabase/supabase-js'
import { loadFriendMaps } from '@/lib/privacy/queries'

export type TaggedUserPreview = {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
}

const MAX_TAGS = 20

/** Keep only accepted friends of the author (never self), capped. */
export async function sanitizeTaggedUserIds(
  supabase: SupabaseClient,
  authorId: string,
  raw: unknown
): Promise<string[]> {
  if (!Array.isArray(raw)) return []
  const ids = [
    ...new Set(
      raw
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
        .filter((id) => id !== authorId)
    ),
  ].slice(0, MAX_TAGS)
  if (ids.length === 0) return []

  const { accepted } = await loadFriendMaps(authorId, ids, supabase)
  return ids.filter((id) => accepted.has(id))
}

export async function replacePostTaggedUsers(
  supabase: SupabaseClient,
  postId: string,
  userIds: string[]
): Promise<void> {
  await supabase.from('post_tagged_users').delete().eq('post_id', postId)
  if (userIds.length === 0) return
  const { error } = await supabase.from('post_tagged_users').insert(
    userIds.map((user_id) => ({ post_id: postId, user_id }))
  )
  if (error) throw new Error(error.message)
}

export async function loadTaggedUsersByPostIds(
  supabase: SupabaseClient,
  postIds: string[]
): Promise<Map<string, TaggedUserPreview[]>> {
  const map = new Map<string, TaggedUserPreview[]>()
  if (postIds.length === 0) return map

  const { data: rows } = await supabase
    .from('post_tagged_users')
    .select('post_id, user_id')
    .in('post_id', postIds)

  if (!rows?.length) return map

  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', userIds)

  const profileById = new Map(
    (profiles || []).map((p) => [
      p.id,
      {
        id: p.id,
        username: p.username,
        full_name: p.full_name,
        avatar_url: p.avatar_url ?? null,
      } satisfies TaggedUserPreview,
    ])
  )

  for (const row of rows) {
    const user = profileById.get(row.user_id)
    if (!user) continue
    const list = map.get(row.post_id) ?? []
    list.push(user)
    map.set(row.post_id, list)
  }
  return map
}

export function formatTaggedPeoplePhrase(users: TaggedUserPreview[]): string | null {
  if (users.length === 0) return null
  const names = users.map((u) => u.full_name || u.username)
  if (names.length === 1) return `with ${names[0]}`
  if (names.length === 2) return `with ${names[0]} and ${names[1]}`
  return `with ${names[0]}, ${names[1]}, and ${names.length - 2} others`
}
