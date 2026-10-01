import type { SupabaseClient } from '@supabase/supabase-js'
import { canComment, canFollow, canViewPost } from '@/shared/utils/visibilityUtils'
import { getRelationships } from '@/lib/privacy/access'

const LATEST_COMMENTS_PREVIEW = 3
const MAX_REACTION_PREVIEW_USERS = 3

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

type CommentPreview = {
  id: string
  post_id: string
  content: string
  created_at: string
  parent_id: string | null
  author_id: string
  author: {
    id: string
    username: string
    full_name: string
    avatar_url: string | null
    country: string | null
    is_verified: boolean
  } | null
  likes_count: number
  isLiked: boolean
  replies_count: number
  replies: CommentPreview[]
}

function mapCommentPreviewRow(
  row: any,
  likeMeta?: { likes_count: number; isLiked: boolean }
): CommentPreview {
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
          country: author.country ?? null,
          is_verified: author.is_verified ?? false,
        }
      : null,
    likes_count: likeMeta?.likes_count ?? 0,
    isLiked: likeMeta?.isLiked ?? false,
    replies_count: 0,
    replies: [],
  }
}

function assignRepliesCounts(nodes: CommentPreview[]): number {
  let total = 0
  for (const node of nodes) {
    const nested = assignRepliesCounts(node.replies)
    node.replies_count = node.replies.length + nested
    total += 1 + node.replies_count
  }
  return total
}

function nestCommentPreviews(
  rows: any[],
  likeMetaByCommentId: Map<string, { likes_count: number; isLiked: boolean }>
): CommentPreview[] {
  const byId = new Map<string, CommentPreview>()
  const roots: CommentPreview[] = []

  for (const row of rows) {
    byId.set(row.id, mapCommentPreviewRow(row, likeMetaByCommentId.get(row.id)))
  }

  for (const row of rows) {
    const node = byId.get(row.id)!
    if (row.parent_id && byId.has(row.parent_id)) {
      byId.get(row.parent_id)!.replies.push(node)
    } else if (!row.parent_id) {
      roots.push(node)
    }
  }

  assignRepliesCounts(roots)
  return roots
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

function mapEmbeddedRepostPost(row: any) {
  return {
    id: row.id,
    content: row.content,
    category: row.category,
    media_urls: row.media_urls,
    media_type: row.media_type,
    background_id: row.background_id ?? null,
    location: row.location,
    created_at: row.created_at,
    author: row.author
      ? {
          id: row.author.id,
          username: row.author.username,
          full_name: row.author.full_name,
          avatar_url: row.author.avatar_url,
          country: row.author.country,
        }
      : null,
  }
}

/**
 * Visibility filter, reactions, likes, follow flags, optional saved state, and up to three
 * earliest top-level comments per post (with nested replies, replies_count, likes_count, isLiked)
 * — same shape as GET /api/posts.
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
  const relationships = await getRelationships(userId, authorIds, supabase)
  let followingSet = new Set<string>()

  if (userId && authorIds.length > 0) {
    const { data: followingRows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)
      .in('following_id', authorIds)
    followingSet = new Set((followingRows || []).map((r: { following_id: string }) => r.following_id))
  }

  const filtered = scoped.filter((p: any) => {
    const rel = relationships.get(p.author_id)
    const vis = p.author?.post_visibility ?? rel?.settings.post_visibility ?? 'public'
    return canViewPost(userId, p.author_id, vis, rel?.isFriend ?? false, rel?.isBlocked ?? false)
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

  let sharedPostIds = new Set<string>()
  if (userId && filtered.length > 0) {
    const { data: sharesRows } = await supabase
      .from('shares')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', filtered.map((p: any) => p.id))
    if (sharesRows) {
      sharedPostIds = new Set(sharesRows.map((r: any) => r.post_id))
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
        if (
          profile &&
          group.users.length < MAX_REACTION_PREVIEW_USERS &&
          !group.users.find((u: any) => u.id === profile.id)
        ) {
          group.users.push(profile)
        }
        if (userId && r.user_id === userId) {
          group.currentUserReacted = true
        }
      }
    }
  }

  const latestCommentsByPostId = new Map<string, CommentPreview[]>()
  if (postIds.length > 0) {
    // Parallel limited top-level fetch (3/post), then one BFS for nested replies.
    const previewTopLevelByPost = new Map<string, any[]>()
    const previewParentIds: string[] = []

    const topLevelResults = await Promise.all(
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

    for (const { postId, rows } of topLevelResults) {
      previewTopLevelByPost.set(postId, rows)
      for (const row of rows) {
        previewParentIds.push(row.id)
      }
    }

    const replyRows: any[] = []
    let pendingParentIds = previewParentIds

    while (pendingParentIds.length > 0) {
      const { data: childComments, error: childError } = await supabase
        .from('comments')
        .select(COMMENT_PREVIEW_SELECT)
        .in('parent_id', pendingParentIds)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })

      if (childError || !childComments || childComments.length === 0) {
        break
      }

      replyRows.push(...childComments)
      pendingParentIds = childComments.map((comment: { id: string }) => comment.id)
    }

    const allPreviewRows = [
      ...Array.from(previewTopLevelByPost.values()).flat(),
      ...replyRows,
    ]
    const allPreviewIds = allPreviewRows.map((row: { id: string }) => row.id)

    const likeMetaByCommentId = new Map<string, { likes_count: number; isLiked: boolean }>()
    for (const id of allPreviewIds) {
      likeMetaByCommentId.set(id, { likes_count: 0, isLiked: false })
    }

    if (allPreviewIds.length > 0) {
      const { data: likesRows } = await supabase
        .from('likes')
        .select('comment_id, user_id')
        .in('comment_id', allPreviewIds)

      for (const like of likesRows || []) {
        const meta = likeMetaByCommentId.get(like.comment_id)
        if (!meta) continue
        meta.likes_count += 1
        if (userId && like.user_id === userId) {
          meta.isLiked = true
        }
      }
    }

    const repliesByPostId = new Map<string, any[]>()
    for (const row of replyRows) {
      const list = repliesByPostId.get(row.post_id) || []
      list.push(row)
      repliesByPostId.set(row.post_id, list)
    }

    for (const postId of postIds) {
      const topLevel = previewTopLevelByPost.get(postId) || []
      const replies = repliesByPostId.get(postId) || []
      latestCommentsByPostId.set(
        postId,
        nestCommentPreviews([...topLevel, ...replies], likeMetaByCommentId)
      )
    }
  }

  const repostSourceIds = [
    ...new Set(filtered.filter((p: any) => !p.repost_of_id).map((p: any) => p.id)),
  ]
  let repostedByUserIds = new Set<string>()
  if (userId && repostSourceIds.length > 0) {
    const { data: userReposts } = await supabase
      .from('posts')
      .select('repost_of_id')
      .eq('author_id', userId)
      .eq('is_deleted', false)
      .in('repost_of_id', repostSourceIds)
    if (userReposts) {
      repostedByUserIds = new Set(userReposts.map((r: any) => r.repost_of_id))
    }
  }

  const embeddedSourceIds = [
    ...new Set(filtered.map((p: any) => p.repost_of_id).filter(Boolean)),
  ]
  const embeddedById = new Map<string, ReturnType<typeof mapEmbeddedRepostPost>>()
  if (embeddedSourceIds.length > 0) {
    const { data: embeddedRows } = await supabase
      .from('posts')
      .select(
        `
        id, content, category, media_urls, media_type, background_id, location, created_at,
        author:profiles!posts_author_id_fkey(
          id, username, full_name, avatar_url, country
        )
      `
      )
      .in('id', embeddedSourceIds)
      .eq('is_deleted', false)

    if (embeddedRows) {
      for (const row of embeddedRows) {
        embeddedById.set(row.id, mapEmbeddedRepostPost(row))
      }
    }
  }

  return filtered.map((post: any) => {
    const rel = relationships.get(post.author_id)
    const isMutual = rel?.isFriend ?? false
    const allowComments = post.author?.allow_comments ?? rel?.settings.allow_comments ?? 'everyone'
    const allowFollows = post.author?.allow_follows ?? rel?.settings.allow_follows ?? 'everyone'

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
      isShare: userId ? sharedPostIds.has(post.id) : false,
      is_following: userId && userId !== post.author_id ? followingSet.has(post.author_id) : false,
      reactions: reactionGroupsArray,
      reactions_total_count: postReactions?.totalCount ?? 0,
      canComment: canComment(userId, post.author_id, allowComments, isMutual, rel?.isBlocked ?? false),
      canFollow:
        userId && userId !== post.author_id
          ? canFollow(userId, post.author_id, allowFollows, isMutual, rel?.isBlocked ?? false)
          : false,
      repost_of_id: post.repost_of_id ?? null,
      reposted_post: post.repost_of_id
        ? embeddedById.get(post.repost_of_id) ?? null
        : null,
      is_reposted: userId ? repostedByUserIds.has(post.id) : false,
    }
  })
}
