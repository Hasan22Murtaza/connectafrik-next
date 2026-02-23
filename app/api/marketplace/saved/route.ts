import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: savesData, error: savesError } = await supabase
      .from('product_saves')
      .select('created_at, product_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (savesError) throw savesError

    if (!savesData || savesData.length === 0) {
      return jsonResponse({ data: [] })
    }

    const productIds = savesData.map(save => save.product_id)

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds)

    if (productsError) throw productsError

    const sellerIds = [...new Set((products || []).map(p => p.seller_id))]
    const { data: sellers } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', sellerIds)

    const sellerMap = new Map((sellers || []).map(s => [s.id, s]))

    const productsWithSellers = (products || []).map(product => ({
      ...product,
      seller: sellerMap.get(product.seller_id) || null,
      is_saved: true,
    }))

    return jsonResponse({ data: productsWithSellers })
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    console.error('GET /api/marketplace/saved error:', err)
    return errorResponse(err.message || 'Failed to fetch saved products', 500)
  }
}
