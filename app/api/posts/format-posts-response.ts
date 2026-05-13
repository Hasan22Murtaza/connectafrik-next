import type { SupabaseClient } from '@supabase/supabase-js'

const LATEST_COMMENTS_PREVIEW = 3

const COMMENT_PREVIEW_SELECT = `
  id,
  post_id,
  content,
  created_at,
  parent_id,
  author_id,
  author:profiles!comments_author_id_fkey(
    id,
    username,
    full_name,
    avatar_url,
    country,
    is_verified
  )
`

function mapCommentPreviewRow(row: any) {
  const author = row.author
  return {
    id: row.id,
    post_id: row.post_id,
    content: row.content,
    created_at: row.created_at,
    parent_id: row.parent_id ?? null,
    author_id: row.author_id,
    author: author
      ? {
          id: author.id,
          username: author.username,
          full_name: author.full_name,
          avatar_url: author.avatar_url,
          country: author.country,
          is_verified: author.is_verified ?? false,
        }
      : null,
  }
}

export const POST_SELECT = `
  *,
  author:profiles!posts_author_id_fkey(
    id, username, full_name, avatar_url, country,
    post_visibility, allow_comments, allow_follows
  ),
  comments(count)
`

export function computePermission(
  viewerId: string | null,
  ownerId: string,
  level: string,
  isMutual: boolean
): boolean {
  if (!viewerId) return false
  if (viewerId === ownerId) return true
  if (level === 'none') return false
  if (level === 'everyone' || level === 'public') return true
  if (level === 'friends') return isMutual
  return false
}

export type FormatPostsOptions = {
  /** All posts in this list are known to be saved by the current user (skips extra query). */
  markAllSaved?: boolean
  /** Keep only rows authored by this user (e.g. GET /api/users/:id/posts). */
  onlyAuthorId?: string
}

/**
 * Visibility filter, reactions, likes, follow flags, optional saved state, and up to three earliest top-level comments per post — same shape as GET /api/posts.
 */
export async function formatPostsForClient(
  supabase: SupabaseClient,
  userId: string | null,
  posts: any[],
  options?: FormatPostsOptions
): Promise<any[]> {
  const scoped =
    options?.onlyAuthorId != null
      ? posts.filter((p: any) => p.author_id === options.onlyAuthorId)
      : posts

  const authorIds = [...new Set(scoped.map((p: any) => p.author_id))]
  let mutualSet = new Set<string>()
  let followingSet = new Set<string>()

  if (userId && authorIds.length > 0) {
    const mutualChecks = await Promise.all(
      authorIds.map(async (authorId: string) => {
        if (authorId === userId) return { authorId, isMutual: true, isFollowing: false }
        const [aToB, bToA] = await Promise.all([
          supabase.from('follows').select('id').eq('follower_id', userId).eq('following_id', authorId).maybeSingle(),
          supabase.from('follows').select('id').eq('follower_id', authorId).eq('following_id', userId).maybeSingle(),
        ])
        return { authorId, isMutual: !!aToB.data && !!bToA.data, isFollowing: !!aToB.data }
      })
    )
    mutualChecks.forEach((c: any) => {
      if (c.isMutual) mutualSet.add(c.authorId)
      if (c.isFollowing) followingSet.add(c.authorId)
    })
  }

  const filtered = scoped.filter((p: any) => {
    const vis = p.author?.post_visibility ?? 'public'
    if (userId === p.author_id) return true
    if (vis === 'public' || vis === 'everyone') return true
    if (vis === 'private') return false
    if (vis === 'friends') return mutualSet.has(p.author_id)
    return false
  })

  let likedPostIds = new Set<string>()
  if (userId && filtered.length > 0) {
    const { data: reactionsByUser } = await supabase
      .from('post_reactions')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', filtered.map((p: any) => p.id))

    if (reactionsByUser) {
      likedPostIds = new Set(reactionsByUser.map((r: any) => r.post_id))
    }
  }

  let savedPostIds = new Set<string>()
  if (userId && filtered.length > 0) {
    if (options?.markAllSaved) {
      filtered.forEach((p: any) => savedPostIds.add(p.id))
    } else {
      const { data: savesRows } = await supabase
        .from('post_saves')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', filtered.map((p: any) => p.id))
      if (savesRows) {
        savedPostIds = new Set(savesRows.map((r: any) => r.post_id))
      }
    }
  }

  const postIds = filtered.map((p: any) => p.id)
  const reactionsMap = new Map<string, { groups: Record<string, any>; totalCount: number }>()
  if (postIds.length > 0) {
    const { data: reactionsData } = await supabase
      .from('post_reactions')
      .select('post_id, user_id, reaction_type')
      .in('post_id', postIds)

    if (reactionsData && reactionsData.length > 0) {
      const reactingUserIds = [...new Set(reactionsData.map((r: any) => r.user_id))]
      let profileMap = new Map<string, any>()
      if (reactingUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', reactingUserIds)
        if (profiles) {
          profileMap = new Map(profiles.map((p: any) => [p.id, p]))
        }
      }

      for (const r of reactionsData) {
        if (!reactionsMap.has(r.post_id)) {
          reactionsMap.set(r.post_id, { groups: {} as Record<string, any>, totalCount: 0 })
        }
        const entry = reactionsMap.get(r.post_id)!
        if (!entry.groups[r.reaction_type]) {
          entry.groups[r.reaction_type] = { type: r.reaction_type, count: 0, users: [], currentUserReacted: false }
        }
        const group = entry.groups[r.reaction_type]
        group.count++
        entry.totalCount++
        const profile = profileMap.get(r.user_id)
        if (profile && !group.users.find((u: any) => u.id === profile.id)) {
          group.users.push(profile)
        }
        if (userId && r.user_id === userId) {
          group.currentUserReacted = true
        }
      }
    }
  }

  const latestCommentsByPostId = new Map<string, ReturnType<typeof mapCommentPreviewRow>[]>()
  if (postIds.length > 0) {
    const previewRows = await Promise.all(
      postIds.map(async (postId: string) => {
        const { data, error } = await supabase
          .from('comments')
          .select(COMMENT_PREVIEW_SELECT)
          .eq('post_id', postId)
          .eq('is_deleted', false)
          .is('parent_id', null)
          .order('created_at', { ascending: true })
          .limit(LATEST_COMMENTS_PREVIEW)

        if (error) {
          return { postId, rows: [] as any[] }
        }
        return { postId, rows: data || [] }
      })
    )
    for (const { postId, rows } of previewRows) {
      latestCommentsByPostId.set(postId, rows.map(mapCommentPreviewRow))
    }
  }

  return filtered.map((post: any) => {
    const isMutual = mutualSet.has(post.author_id)
    const allowComments = post.author?.allow_comments ?? 'everyone'
    const allowFollows = post.author?.allow_follows ?? 'everyone'

    const realCommentCount =
      Array.isArray(post.comments) && post.comments.length > 0
        ? post.comments[0].count
        : post.comments_count

    const postReactions = reactionsMap.get(post.id)
    const reactionGroupsArray = postReactions
      ? Object.values(postReactions.groups).sort((a: any, b: any) => b.count - a.count)
      : []

    return {
      id: post.id,
      author_id: post.author_id,
      content: post.content,
      category: post.category,
      tags: post.tags,
      background_id: post.background_id ?? null,
      media_urls: post.media_urls,
      media_type: post.media_type,
      likes_count: post.likes_count,
      comments_count: realCommentCount,
      comments: latestCommentsByPostId.get(post.id) ?? [],
      shares_count: post.shares_count,
      views_count: post.views_count,
      location: post.location,
      created_at: post.created_at,
      author: post.author
        ? {
            id: post.author.id,
            username: post.author.username,
            full_name: post.author.full_name,
            avatar_url: post.author.avatar_url,
            country: post.author.country,
          }
        : null,
      isLiked: likedPostIds.has(post.id),
      is_saved: userId ? savedPostIds.has(post.id) : false,
      is_following: userId && userId !== post.author_id ? followingSet.has(post.author_id) : false,
      reactions: reactionGroupsArray,
      reactions_total_count: postReactions?.totalCount ?? 0,
      canComment: computePermission(userId, post.author_id, allowComments, isMutual),
      canFollow:
        userId && userId !== post.author_id
          ? computePermission(userId, post.author_id, allowFollows, isMutual)
          : false,
    }
  })
}
