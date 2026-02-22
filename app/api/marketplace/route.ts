import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const currency = searchParams.get('currency')
    const search = searchParams.get('search')
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')
    const seller_id = searchParams.get('seller_id')

    let userId: string | null = null
    let supabase

    try {
      const auth = await getAuthenticatedUser(request)
      userId = auth.user.id
      supabase = auth.supabase
    } catch {
      supabase = createClient(supabaseUrl, supabaseAnonKey)
    }

    let query = supabase
      .from('products')
      .select('*')
      .eq('is_available', true)
      .order('created_at', { ascending: false })

    if (category) query = query.eq('category', category)
    if (currency) query = query.eq('currency', currency)
    if (seller_id) query = query.eq('seller_id', seller_id)
    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    if (limit) query = query.limit(parseInt(limit))
    if (offset) query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit || '20') - 1)

    const { data: products, error } = await query

    if (error) throw error

    const productList = products || []

    const sellerIds = [...new Set(productList.map(p => p.seller_id))]
    const { data: sellers } = sellerIds.length > 0
      ? await supabase.from('profiles').select('id, username, full_name, avatar_url').in('id', sellerIds)
      : { data: [] }

    const sellerMap = new Map((sellers || []).map(s => [s.id, s]))

    let savedIds = new Set<string>()
    if (userId && productList.length > 0) {
      const productIds = productList.map(p => p.id)
      const { data: saves } = await supabase
        .from('product_saves')
        .select('product_id')
        .eq('user_id', userId)
        .in('product_id', productIds)

      savedIds = new Set(saves?.map(s => s.product_id) || [])
    }

    const result = productList.map(p => ({
      ...p,
      seller: sellerMap.get(p.seller_id) || null,
      is_saved: savedIds.has(p.id),
    }))

    return jsonResponse({ data: result })
  } catch (err: any) {
    console.error('GET /api/marketplace error:', err)
    return errorResponse(err.message || 'Failed to fetch products', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const { data, error } = await supabase
      .from('products')
      .insert({
        seller_id: user.id,
        title: body.title,
        description: body.description,
        price: body.price,
        currency: body.currency,
        category: body.category,
        condition: body.condition,
        location: body.location || null,
        country: body.country || null,
        images: body.images || [],
        tags: body.tags || [],
        stock_quantity: body.stock_quantity ?? 1,
        is_available: true,
        is_featured: false,
      })
      .select()
      .single()

    if (error) throw error

    return jsonResponse({ data }, 201)
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('POST /api/marketplace error:', err)
    return errorResponse(err.message || 'Failed to create product', 500)
  }
}
