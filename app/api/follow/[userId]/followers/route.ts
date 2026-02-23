import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    let supabase

    try {
      const auth = await getAuthenticatedUser(request)
      supabase = auth.supabase
    } catch {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const { data: rows, error } = await supabase
      .from('follows')
      .select('follower_id, created_at')
      .eq('following_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return errorResponse(error.message, 400)
    }

    if (!rows?.length) {
      return jsonResponse({ data: [] })
    }

    const ids = [...new Set(rows.map((r: any) => r.follower_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', ids)

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))
    const result = rows.map((r: any) => ({
      follower_id: r.follower_id,
      created_at: r.created_at,
      follower: profileMap.get(r.follower_id) ?? null,
    }))

    return jsonResponse({ data: result })
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch followers', 500)
  }
}
