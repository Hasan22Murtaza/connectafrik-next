import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const PAGE_SIZE = 10

const POST_SELECT = `
  *,
  author:profiles!posts_author_id_fkey(
    id, username, full_name, avatar_url, country,
    post_visibility, allow_comments, allow_follows
  ),
  comments(count)
`

const POST_SELECT_SINGLE = `
  *,
  author:profiles!posts_author_id_fkey(
    id, username, full_name, avatar_url, country
  )
`

export async function GET(request: NextRequest) {
  try {
    let userId: string | null = null
    let supabase

    try {
      const auth = await getAuthenticatedUser(request)
      userId = auth.user.id
      supabase = auth.supabase
    } catch {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || String(PAGE_SIZE), 10) || PAGE_SIZE, 1), PAGE_SIZE)
    const category = searchParams.get('category') || undefined
    const subcategory = searchParams.get('subcategory') || undefined

    let query = supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    if ((category === 'culture' || category === 'politics') && subcategory) {
      query = query.contains('tags', [subcategory])
    }

    const from = page * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: postsData, error: postsError } = await query

    if (postsError) {
      return errorResponse(postsError.message, 400)
    }

    const posts = postsData || []

    // Visibility filtering: check mutual-follow status for friends-only posts
    const authorIds = [...new Set(posts.map((p: any) => p.author_id))]
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

    const filtered = posts.filter((p: any) => {
      const vis = p.author?.post_visibility ?? 'public'
      if (userId === p.author_id) return true
      if (vis === 'public' || vis === 'everyone') return true
      if (vis === 'private') return false
      if (vis === 'friends') return mutualSet.has(p.author_id)
      return false
    })

    // Fetch reaction status for the current user
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

    // Batch-fetch reactions for all posts
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
            .select('id, full_name')
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

    const result = filtered.map((post: any) => {
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
        title: post.title,
        content: post.content,
        category: post.category,
        tags: post.tags,
        media_urls: post.media_urls,
        media_type: post.media_type,
        likes_count: post.likes_count,
        comments_count: realCommentCount,
        shares_count: post.shares_count,
        views_count: post.views_count,
        location: post.location,
        created_at: post.created_at,
        author: post.author ? {
          id: post.author.id,
          username: post.author.username,
          full_name: post.author.full_name,
          avatar_url: post.author.avatar_url,
          country: post.author.country,
        } : null,
        isLiked: likedPostIds.has(post.id),
        is_following: userId && userId !== post.author_id ? followingSet.has(post.author_id) : false,
        reactions: reactionGroupsArray,
        reactions_total_count: postReactions?.totalCount ?? 0,
        canComment: computePermission(userId, post.author_id, allowComments, isMutual),
        canFollow: userId && userId !== post.author_id
          ? computePermission(userId, post.author_id, allowFollows, isMutual)
          : false,
      }
    })

    return jsonResponse({
      data: result,
      page,
      pageSize: limit,
      hasMore: posts.length === limit,
    })
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch posts', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const { title, content, category, media_type, media_urls, tags, location } = body

    if (!content) {
      return errorResponse('Content is required', 400)
    }

    const { data: post, error: insertError } = await supabase
      .from('posts')
      .insert({
        title: title || '',
        content,
        category: category || 'general',
        media_type: media_type || 'none',
        media_urls: media_urls || [],
        tags: tags || [],
        location: location || null,
        author_id: user.id,
      })
      .select(POST_SELECT_SINGLE)
      .single()

    if (insertError) {
      return errorResponse(insertError.message, 400)
    }

    // Fire-and-forget: notify followers and friends
    notifyFollowersAndFriends(supabase, user, post).catch(() => {})

    return jsonResponse({
      data: {
        id: post.id,
        author_id: post.author_id,
        title: post.title,
        content: post.content,
        category: post.category,
        tags: post.tags,
        media_urls: post.media_urls,
        media_type: post.media_type,
        likes_count: post.likes_count ?? 0,
        comments_count: post.comments_count ?? 0,
        shares_count: post.shares_count ?? 0,
        views_count: post.views_count ?? 0,
        location: post.location,
        created_at: post.created_at,
        author: post.author ? {
          id: post.author.id,
          username: post.author.username,
          full_name: post.author.full_name,
          avatar_url: post.author.avatar_url,
          country: post.author.country,
        } : null,
        isLiked: false,
      },
    }, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to create post', 500)
  }
}

function computePermission(
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

async function notifyFollowersAndFriends(supabase: any, user: any, post: any) {
  try {
    const authorName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Someone'
    const postTitle = post.title || post.content?.substring(0, 50) || 'a new post'

    const [{ data: followersData }, { data: friendsData }] = await Promise.all([
      supabase.from('follows').select('follower_id').eq('following_id', user.id),
      supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'accepted'),
    ])

    const recipientIds = new Set<string>()

    followersData?.forEach((f: any) => {
      if (f.follower_id !== user.id) recipientIds.add(f.follower_id)
    })
    friendsData?.forEach((f: any) => {
      const friendId = f.sender_id === user.id ? f.receiver_id : f.sender_id
      if (friendId && friendId !== user.id) recipientIds.add(friendId)
    })

    const { sendNotification } = await import('@/shared/services/notificationService')

    await Promise.allSettled(
      Array.from(recipientIds).map((recipientId) =>
        sendNotification({
          user_id: recipientId,
          title: 'New Post',
          body: `${authorName} shared a new post: "${postTitle}"`,
          notification_type: 'system',
          data: {
            type: 'new_post',
            post_id: post.id,
            author_id: user.id,
            author_name: authorName,
            url: `/post/${post.id}`,
          },
        }).catch(() => ({ success: false }))
      )
    )
  } catch {
    // Notifications are best-effort
  }
}
