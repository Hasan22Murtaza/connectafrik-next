import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const REEL_SELECT = `
  *,
  profiles:profiles!reels_author_id_fkey(username, full_name, avatar_url)
`

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

    let interaction_state: { isLiked: boolean; isSaved: boolean; isFollowing: boolean; hasViewed: boolean } | undefined

    try {
      const { user } = await getAuthenticatedUser(request)
      const [likeRes, saveRes, followRes, viewRes] = await Promise.all([
        supabase.from('reel_likes').select('id').eq('reel_id', id).eq('user_id', user.id).maybeSingle(),
        supabase.from('reel_saves').select('id').eq('reel_id', id).eq('user_id', user.id).maybeSingle(),
        reel.author_id
          ? supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', reel.author_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('reel_views').select('id').eq('reel_id', id).eq('user_id', user.id).maybeSingle(),
      ])
      interaction_state = {
        isLiked: !!likeRes.data,
        isSaved: !!saveRes.data,
        isFollowing: !!followRes.data,
        hasViewed: !!viewRes.data,
      }
    } catch {
      interaction_state = undefined
    }

    return jsonResponse({ data: { ...reel, interaction_state } })
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

    const allowed = ['title', 'description', 'category', 'tags', 'is_public']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key]
    }
    if (Object.keys(updates).length === 0) return errorResponse('No valid fields to update', 400)

    const { data: reel, error } = await supabase
      .from('reels')
      .update(updates)
      .eq('id', id)
      .eq('author_id', user.id)
      .select(REEL_SELECT)
      .single()

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

    const { error } = await supabase
      .from('reels')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('author_id', user.id)

    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(err.message || 'Failed to delete reel', 500)
  }
}
