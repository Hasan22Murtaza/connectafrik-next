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
    const category = searchParams.get('category') || undefined
    const author_id = searchParams.get('author_id') || undefined
    const is_featured = searchParams.get('is_featured')
    const min_duration = searchParams.get('min_duration')
    const max_duration = searchParams.get('max_duration')
    const tagsParam = searchParams.get('tags')
    const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : undefined
    const search = searchParams.get('search') || undefined
    const sort_field = searchParams.get('sort_field') || 'created_at'
    const sort_order = searchParams.get('sort_order') || 'desc'
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10), 1), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0)

    let query = supabase
      .from('reels')
      .select(REEL_SELECT, { count: 'exact' })
      .eq('is_deleted', false)
      .eq('is_public', true)

    if (category) query = query.eq('category', category)
    if (author_id) query = query.eq('author_id', author_id)
    if (is_featured !== undefined && is_featured !== '') query = query.eq('is_featured', is_featured === 'true')
    if (min_duration != null && min_duration !== '') query = query.gte('duration', parseInt(min_duration, 10))
    if (max_duration != null && max_duration !== '') query = query.lte('duration', parseInt(max_duration, 10))
    if (tags && tags.length > 0) query = query.overlaps('tags', tags)
    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)

    query = query.order(sort_field, { ascending: sort_order === 'asc' }).range(offset, offset + limit - 1)

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

    return jsonResponse({ data: result, limit, offset })
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
