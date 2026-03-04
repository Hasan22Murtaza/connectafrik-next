import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: existing } = await supabase
      .from('product_saves')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('product_saves')
        .delete()
        .eq('product_id', id)
        .eq('user_id', user.id)

      return jsonResponse({ saved: false })
    }

    await supabase
      .from('product_saves')
      .insert({ product_id: id, user_id: user.id })

    return jsonResponse({ saved: true })
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    console.error('POST /api/marketplace/[id]/save error:', err)
    return errorResponse(err.message || 'Failed to toggle save', 500)
  }
}
