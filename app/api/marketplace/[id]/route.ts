import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    let userId: string | null = null
    let supabase

    try {
      const auth = await getAuthenticatedUser(request)
      userId = auth.user.id
      supabase = auth.supabase
    } catch {
      supabase = createClient(supabaseUrl, supabaseAnonKey)
    }

    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    if (product.seller_id) {
      const { data: seller } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, bio')
        .eq('id', product.seller_id)
        .single()

      if (seller) product.seller = seller
    }

    if (userId) {
      const { data: saveData } = await supabase
        .from('product_saves')
        .select('id')
        .eq('user_id', userId)
        .eq('product_id', id)
        .maybeSingle()

      product.is_saved = !!saveData
    } else {
      product.is_saved = false
    }

    return jsonResponse({ data: product })
  } catch (err: any) {
    console.error('GET /api/marketplace/[id] error:', err)
    return errorResponse(err.message || 'Failed to fetch product', 500)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const { data: existing } = await supabase
      .from('products')
      .select('seller_id')
      .eq('id', id)
      .single()

    if (!existing || existing.seller_id !== user.id) {
      return errorResponse('Only the seller can update this product', 403)
    }

    const { data, error } = await supabase
      .from('products')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return jsonResponse({ data })
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('PATCH /api/marketplace/[id] error:', err)
    return errorResponse(err.message || 'Failed to update product', 500)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: existing } = await supabase
      .from('products')
      .select('seller_id')
      .eq('id', id)
      .single()

    if (!existing || existing.seller_id !== user.id) {
      return errorResponse('Only the seller can delete this product', 403)
    }

    const { error } = await supabase
      .from('products')
      .update({ is_available: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error

    return jsonResponse({ success: true })
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('DELETE /api/marketplace/[id] error:', err)
    return errorResponse(err.message || 'Failed to delete product', 500)
  }
}
