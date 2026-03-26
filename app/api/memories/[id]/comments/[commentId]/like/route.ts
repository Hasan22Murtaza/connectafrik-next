import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id: reelId, commentId } = await params
    const { user } = await getAuthenticatedUser(request)
    const supabase = createServiceClient()

    // Ensure comment belongs to the reel route segment.
    const { data: comment, error: commentErr } = await supabase
      .from('reel_comments')
      .select('id')
      .eq('id', commentId)
      .eq('reel_id', reelId)
      .single()
    if (commentErr || !comment) return errorResponse('Comment not found', 404)

    const { data: existing, error: existingErr } = await supabase
      .from('reel_comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (existingErr) return errorResponse(existingErr.message, 400)

    let liked: boolean
    if (existing) {
      const { error } = await supabase
        .from('reel_comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
      if (error) return errorResponse(error.message, 400)
      liked = false
    } else {
      const { error } = await supabase.from('reel_comment_likes').insert({ comment_id: commentId, user_id: user.id })
      if (error) return errorResponse(error.message, 400)
      liked = true
    }

    return jsonResponse({ data: { liked } })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(err.message || 'Failed to toggle comment like', 500)
  }
}

