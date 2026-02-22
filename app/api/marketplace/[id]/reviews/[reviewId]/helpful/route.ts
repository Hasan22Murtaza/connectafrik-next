import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  try {
    const { reviewId } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: existing } = await supabase
      .from('review_helpful')
      .select('id')
      .eq('review_id', reviewId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('review_helpful')
        .delete()
        .eq('review_id', reviewId)
        .eq('user_id', user.id)

      return jsonResponse({ helpful: false })
    }

    await supabase
      .from('review_helpful')
      .insert({ review_id: reviewId, user_id: user.id })

    return jsonResponse({ helpful: true })
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    console.error('POST /api/marketplace/[id]/reviews/[reviewId]/helpful error:', err)
    return errorResponse(err.message || 'Failed to toggle helpful', 500)
  }
}
