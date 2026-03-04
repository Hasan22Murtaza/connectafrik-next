import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jsonResponse, errorResponse } from '@/lib/api-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    await supabase.rpc('increment_product_views', { product_id: id })

    return jsonResponse({ success: true })
  } catch (err: any) {
    console.error('POST /api/marketplace/[id]/view error:', err)
    return errorResponse(err.message || 'Failed to record view', 500)
  }
}
