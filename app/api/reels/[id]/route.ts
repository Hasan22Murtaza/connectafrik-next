import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { deleteFromBunny } from '@/lib/bunny'

const REEL_SELECT = `
  id, author_id, title, description, video_url, thumbnail_url, duration, aspect_ratio,
  category, tags, likes_count, comments_count, shares_count, views_count, saves_count,
  reposts_count, is_public, is_featured, engagement_score, created_at, updated_at,
  profiles:profiles!reels_author_id_fkey(username, full_name, avatar_url)
`

async function safelyCleanupReelMedia(
  supabase: ReturnType<typeof createServiceClient>,
  reelId: string,
  videoUrl: string | null | undefined,
  thumbnailUrl: string | null | undefined
) {
  const candidates = [videoUrl, thumbnailUrl].filter(
    (url): url is string => typeof url === 'string' && url.trim().length > 0
  )

  for (const url of candidates) {
    const [{ count: videoRefs }, { count: thumbRefs }] = await Promise.all([
      supabase
        .from('reels')
        .select('id', { count: 'exact', head: true })
        .neq('id', reelId)
        .eq('is_deleted', false)
        .eq('video_url', url),
      supabase
        .from('reels')
        .select('id', { count: 'exact', head: true })
        .neq('id', reelId)
        .eq('is_deleted', false)
        .eq('thumbnail_url', url),
    ])

    if ((videoRefs ?? 0) > 0 || (thumbRefs ?? 0) > 0) continue

    try {
      await deleteFromBunny(url)
    } catch (err) {
      console.error('Failed to delete reel media from Bunny:', url, err)
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    const { data: reel, error } = await supabase
      .from('reels')
      .select(REEL_SELECT)
      .eq('id', id)
      .eq('is_deleted', false)
      .single()

    if (error || !reel) return errorResponse('Reel not found', 404)

    let viewerId: string | null = null
    try {
      const { user } = await getAuthenticatedUser(request)
      viewerId = user.id
    } catch {
      viewerId = null
    }

    const isOwner = !!(viewerId && viewerId === reel.author_id)
    if (!reel.is_public && !isOwner) {
      return errorResponse('Reel not found', 404)
    }

    let interaction_state:
      | { isLiked: boolean; isSaved: boolean; isReposted: boolean; isFollowing: boolean; hasViewed: boolean }
      | undefined

    if (viewerId) {
      const { checkParentalRestriction, parentalDecisionResponse } = await import('@/lib/family')
      const parental = await checkParentalRestriction(supabase, viewerId, 'reels', {
        reelCategory: typeof reel.category === 'string' ? reel.category : undefined,
      })
      const parentalDenied = parentalDecisionResponse(parental)
      if (parentalDenied) return parentalDenied

      const [likeRes, saveRes, repostRes, followRes, viewRes] = await Promise.all([
        supabase.from('reel_likes').select('id').eq('reel_id', id).eq('user_id', viewerId).maybeSingle(),
        supabase.from('reel_saves').select('id').eq('reel_id', id).eq('user_id', viewerId).maybeSingle(),
        supabase.from('reel_reposts').select('id').eq('reel_id', id).eq('user_id', viewerId).maybeSingle(),
        reel.author_id
          ? supabase
              .from('follows')
              .select('id')
              .eq('follower_id', viewerId)
              .eq('following_id', reel.author_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('reel_views').select('id').eq('reel_id', id).eq('user_id', viewerId).maybeSingle(),
      ])
      interaction_state = {
        isLiked: !!likeRes.data,
        isSaved: !!saveRes.data,
        isReposted: !!repostRes.data,
        isFollowing: !!followRes.data,
        hasViewed: !!viewRes.data,
      }
    }

    return jsonResponse({
      data: {
        ...reel,
        is_liked: interaction_state?.isLiked ?? false,
        is_saved: interaction_state?.isSaved ?? false,
        is_reposted: interaction_state?.isReposted ?? false,
        is_following: interaction_state?.isFollowing ?? false,
        interaction_state,
      },
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    return errorResponse(err.message || 'Failed to fetch reel', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user } = await getAuthenticatedUser(request)
    const supabase = createServiceClient()
    const body = await request.json()

    const allowed = ['title', 'description', 'category', 'tags', 'is_public', 'thumbnail_url']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key]
    }
    if (Object.keys(updates).length === 0) return errorResponse('No valid fields to update', 400)

    if (typeof updates.title === 'string') {
      const title = updates.title.trim()
      if (!title) return errorResponse('Title is required', 400)
      updates.title = title
    }
    if (typeof updates.description === 'string') {
      updates.description = updates.description.trim() || null
    }
    if (Array.isArray(updates.tags)) {
      updates.tags = updates.tags
        .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
        .filter(Boolean)
        .slice(0, 10)
    }

    if (typeof updates.category === 'string') {
      const resolvedCategory = updates.category.trim().toLowerCase()
      updates.category = resolvedCategory
      const { checkParentalRestriction, parentalDecisionResponse } = await import('@/lib/family')
      const parental = await checkParentalRestriction(supabase, user.id, 'reels', {
        reelCategory: resolvedCategory,
      })
      const parentalDenied = parentalDecisionResponse(parental)
      if (parentalDenied) return parentalDenied
    }

    updates.updated_at = new Date().toISOString()

    const { data: reel, error } = await supabase
      .from('reels')
      .update(updates)
      .eq('id', id)
      .eq('author_id', user.id)
      .eq('is_deleted', false)
      .select(REEL_SELECT)
      .maybeSingle()

    if (error) return errorResponse(error.message, 400)
    if (!reel) return errorResponse('Reel not found or you are not the author', 404)
    return jsonResponse({ data: reel })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(err.message || 'Failed to update reel', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user } = await getAuthenticatedUser(request)
    const supabase = createServiceClient()

    const { data: existing, error: fetchError } = await supabase
      .from('reels')
      .select('id, author_id, video_url, thumbnail_url, is_deleted')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) return errorResponse(fetchError.message, 400)
    if (!existing || existing.is_deleted) return errorResponse('Reel not found', 404)
    if (existing.author_id !== user.id) {
      return errorResponse('You can only delete your own reels', 403)
    }

    const { data: deleted, error } = await supabase
      .from('reels')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('author_id', user.id)
      .select('id, video_url, thumbnail_url')
      .maybeSingle()

    if (error) return errorResponse(error.message, 400)
    if (!deleted) return errorResponse('Reel not found or you are not the author', 404)

    void safelyCleanupReelMedia(supabase, id, deleted.video_url, deleted.thumbnail_url)

    return jsonResponse({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(err.message || 'Failed to delete reel', 500)
  }
}
