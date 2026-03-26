import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const REEL_SELECT = `
  *,
  profiles:profiles!reels_author_id_fkey(username, full_name, avatar_url)
`

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()

    let userId: string | null = null
    try {
      const auth = await getAuthenticatedUser(request)
      userId = auth.user.id
    } catch {
      // Anonymous access
    }

    const { searchParams } = new URL(request.url)
    const FEEDS = ['foryou', 'explore', 'following', 'mine'] as const
    type FeedType = (typeof FEEDS)[number]
    const rawFeed = searchParams.get('feed')
    const feed = rawFeed && FEEDS.includes(rawFeed as FeedType) ? (rawFeed as FeedType) : null

    const category = searchParams.get('category') || undefined
    let author_id = searchParams.get('author_id') || undefined
    let followingFeed = searchParams.get('following') === 'true'
    if (feed === 'following') followingFeed = true
    if (feed === 'mine' && userId) {
      author_id = userId
    }

    const is_featured = searchParams.get('is_featured')
    const min_duration = searchParams.get('min_duration')
    const max_duration = searchParams.get('max_duration')
    const tagsParam = searchParams.get('tags')
    const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : undefined
    const search = searchParams.get('search') || undefined
    const sortFieldExplicit = searchParams.has('sort_field')
    let sort_field = searchParams.get('sort_field') || 'created_at'
    const sort_order = searchParams.get('sort_order') || 'desc'
    if (feed === 'foryou' && !sortFieldExplicit) {
      sort_field = 'engagement_score'
    }
    const parsedLimit = parseInt(searchParams.get('limit') || '10', 10)
    const parsedPage = parseInt(searchParams.get('page') || '0', 10)
    const limit = Number.isNaN(parsedLimit) ? 10 : Math.min(Math.max(parsedLimit, 1), 100)
    const page = Number.isNaN(parsedPage) ? 0 : Math.max(parsedPage, 0)
    const from = page * limit
    const to = from + limit - 1

    if (feed === 'mine' && !userId) {
      return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
    }

    if (followingFeed) {
      if (!userId) {
        return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
      }
      const { data: followsRows, error: followsErr } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)
      if (followsErr) return errorResponse(followsErr.message, 400)
      const followingIds = [...new Set((followsRows ?? []).map((r: { following_id: string }) => r.following_id))]
      if (followingIds.length === 0) {
        return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
      }

      let fq = supabase
        .from('reels')
        .select(REEL_SELECT, { count: 'exact' })
        .eq('is_deleted', false)
        .eq('is_public', true)
        .in('author_id', followingIds)

      if (category) fq = fq.eq('category', category)
      if (is_featured !== undefined && is_featured !== '') fq = fq.eq('is_featured', is_featured === 'true')
      if (min_duration != null && min_duration !== '') fq = fq.gte('duration', parseInt(min_duration, 10))
      if (max_duration != null && max_duration !== '') fq = fq.lte('duration', parseInt(max_duration, 10))
      if (tags && tags.length > 0) fq = fq.overlaps('tags', tags)
      if (search) fq = fq.or(`title.ilike.%${search}%,description.ilike.%${search}%`)

      fq = fq.order(sort_field, { ascending: sort_order === 'asc' }).range(from, to)
      const { data: fData, error: fError } = await fq
      if (fError) return errorResponse(fError.message, 400)
      const reels = fData ?? []
      let followingSet = new Set<string>()
      if (userId && reels.length > 0) {
        const authorIds = [...new Set(reels.map((r: { author_id: string }) => r.author_id).filter((id: string) => id !== userId))]
        if (authorIds.length > 0) {
          const { data: followsData } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', userId)
            .in('following_id', authorIds)
          if (followsData) followingSet = new Set(followsData.map((f: { following_id: string }) => f.following_id))
        }
      }
      const result = reels.map((reel: Record<string, unknown>) => ({
        ...reel,
        is_following: userId && userId !== reel.author_id ? followingSet.has(reel.author_id as string) : false,
      }))
      return jsonResponse({ data: result, page, pageSize: limit, hasMore: result.length === limit })
    }

    const viewingOwnReels = !!(userId && author_id && author_id === userId)

    let query = supabase.from('reels').select(REEL_SELECT, { count: 'exact' }).eq('is_deleted', false)

    if (!viewingOwnReels) {
      query = query.eq('is_public', true)
    }

    if (category) query = query.eq('category', category)
    if (author_id) query = query.eq('author_id', author_id)
    if (is_featured !== undefined && is_featured !== '') query = query.eq('is_featured', is_featured === 'true')
    if (min_duration != null && min_duration !== '') query = query.gte('duration', parseInt(min_duration, 10))
    if (max_duration != null && max_duration !== '') query = query.lte('duration', parseInt(max_duration, 10))
    if (tags && tags.length > 0) query = query.overlaps('tags', tags)
    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)

    query = query.order(sort_field, { ascending: sort_order === 'asc' }).range(from, to)

    const { data, error } = await query

    if (error) return errorResponse(error.message, 400)

    const reels = data ?? []

    let followingSet = new Set<string>()
    if (userId && reels.length > 0) {
      const authorIds = [...new Set(reels.map((r: any) => r.author_id).filter((id: string) => id !== userId))]
      if (authorIds.length > 0) {
        const { data: followsData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId)
          .in('following_id', authorIds)
        if (followsData) {
          followingSet = new Set(followsData.map((f: any) => f.following_id))
        }
      }
    }

    const result = reels.map((reel: any) => ({
      ...reel,
      is_following: userId && userId !== reel.author_id ? followingSet.has(reel.author_id) : false,
    }))

    return jsonResponse({
      data: result,
      page,
      pageSize: limit,
      hasMore: result.length === limit,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    return errorResponse(err.message || 'Failed to fetch reels', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const supabase = createServiceClient()
    const body = await request.json()

    const {
      title,
      description,
      video_url,
      thumbnail_url,
      duration,
      aspect_ratio,
      category,
      tags,
      is_public,
    } = body

    if (!title || !video_url || duration == null) {
      return errorResponse('title, video_url, and duration are required', 400)
    }

    const { data: reel, error } = await supabase
      .from('reels')
      .insert({
        author_id: user.id,
        title,
        description: description ?? null,
        video_url,
        thumbnail_url: thumbnail_url ?? null,
        duration: Number(duration),
        aspect_ratio: aspect_ratio ?? null,
        category: category ?? null,
        tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
        is_public: is_public !== false,
      })
      .select(REEL_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ data: reel }, 201)
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(err.message || 'Failed to create reel', 500)
  }
}
