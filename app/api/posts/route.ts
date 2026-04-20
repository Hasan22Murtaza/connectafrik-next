import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { sendPostCreatedEmail } from '@/shared/services/emailService'
import { POST_SELECT, formatPostsForClient } from './format-posts-response'

const PAGE_SIZE = 10

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

    const result = await formatPostsForClient(supabase, userId, posts)

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

    const { content, category, media_type, media_urls, tags, location } = body

    if (!content) {
      return errorResponse('Content is required', 400)
    }

    const { data: post, error: insertError } = await supabase
      .from('posts')
      .insert({
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

async function notifyFollowersAndFriends(supabase: any, user: any, post: any) {
  try {
    const serviceSupabase = createServiceClient()
    const authorName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Someone'
    const postTitle = post.content?.substring(0, 80) || 'a new post'
    const postPreview =
      (post.content ? String(post.content).replace(/\s+/g, ' ').trim().slice(0, 120) : '') ||
      'New post'

    const { data: friendsData } = await serviceSupabase
      .from('friend_requests')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('status', 'accepted')

    const recipientIds = new Set<string>()

    friendsData?.forEach((f: any) => {
      const friendId = f.sender_id === user.id ? f.receiver_id : f.sender_id
      if (friendId && friendId !== user.id) recipientIds.add(friendId)
    })

    const notifications = Array.from(recipientIds).map((recipientId) => ({
      user_id: recipientId,
      type: 'post_create',
      title: 'New Post',
      message: `${authorName} shared a new post: "${postTitle}"`,
      data: {
        type: 'post_create',
        post_id: post.id,
        author_id: user.id,
        author_name: authorName,
        url: `/post/${post.id}`,
      },
      is_read: false,
    }))

    if (notifications.length > 0) {
      await serviceSupabase.from('notifications').insert(notifications)
    }

    const emailParams = { authorName, postPreview, postId: post.id as string }

    const emailTasks: Promise<unknown>[] = []

    if (typeof user.email === 'string' && user.email.includes('@')) {
      emailTasks.push(
        sendPostCreatedEmail(user.email, 'author', emailParams).catch((err) =>
          console.error('Post create author email failed:', err)
        )
      )
    }

    for (const friendId of recipientIds) {
      emailTasks.push(
        (async () => {
          const { data: authData, error: authErr } =
            await serviceSupabase.auth.admin.getUserById(friendId)
          const friendEmail = authData?.user?.email
          if (authErr || !friendEmail?.includes('@')) return
          await sendPostCreatedEmail(friendEmail, 'friend', emailParams).catch((err) =>
            console.error('Post create friend email failed:', err)
          )
        })()
      )
    }

    await Promise.allSettled(emailTasks)
  } catch (error) {
    // Notifications are best-effort
    console.error('Post create notification failed:', error)
  }
}
