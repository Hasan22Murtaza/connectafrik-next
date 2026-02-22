import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await params

    let userId: string | null = null
    let supabase

    try {
      const auth = await getAuthenticatedUser(request)
      userId = auth.user.id
      supabase = auth.supabase
    } catch {
      supabase = createClient(supabaseUrl, supabaseAnonKey)
    }

    const { data, error } = await supabase
      .from('product_reviews')
      .select(`
        *,
        user:profiles!product_reviews_user_id_fkey(id, username, full_name, avatar_url)
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })

    if (error) {
      if (error.message?.includes('relation "product_reviews" does not exist')) {
        return jsonResponse({ data: [], userReview: null })
      }
      throw error
    }

    let helpfulReviewIds: string[] = []
    if (userId) {
      const { data: helpfulData } = await supabase
        .from('review_helpful')
        .select('review_id')
        .eq('user_id', userId)

      helpfulReviewIds = helpfulData?.map(h => h.review_id) || []
    }

    const reviews = (data || []).map(review => ({
      ...review,
      user: Array.isArray(review.user) ? review.user[0] : review.user,
      is_helpful: helpfulReviewIds.includes(review.id),
    }))

    const userReview = userId ? reviews.find(r => r.user_id === userId) || null : null

    return jsonResponse({ data: reviews, userReview })
  } catch (err: any) {
    console.error('GET /api/marketplace/[id]/reviews error:', err)
    return errorResponse(err.message || 'Failed to fetch reviews', 500)
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const { data: product } = await supabase
      .from('products')
      .select('seller_id')
      .eq('id', productId)
      .single()

    if (product?.seller_id === user.id) {
      return errorResponse('You cannot review your own product', 400)
    }

    if (body.reviewId) {
      const { error } = await supabase
        .from('product_reviews')
        .update({
          rating: body.rating,
          review_text: body.review_text,
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.reviewId)
        .eq('user_id', user.id)

      if (error) throw error
      return jsonResponse({ success: true, updated: true })
    }

    const { error } = await supabase
      .from('product_reviews')
      .insert({
        product_id: productId,
        user_id: user.id,
        rating: body.rating,
        review_text: body.review_text,
      })

    if (error) throw error
    return jsonResponse({ success: true, created: true }, 201)
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    console.error('POST /api/marketplace/[id]/reviews error:', err)
    return errorResponse(err.message || 'Failed to submit review', 500)
  }
}
