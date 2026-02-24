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
    const parsedLimit = parseInt(searchParams.get('limit') || '20', 10)
    const parsedPage = parseInt(searchParams.get('page') || '0', 10)
    const limit = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 1), 100)
    const page = Number.isNaN(parsedPage) ? 0 : Math.max(parsedPage, 0)
    const from = page * limit
    const to = from + limit - 1

    const { data: rows, error } = await supabase
      .from('follows')
      .select('following_id, created_at')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      return errorResponse(error.message, 400)
    }

    if (!rows?.length) {
      return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
    }

    const ids = [...new Set(rows.map((r: any) => r.following_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', ids)

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))
    const result = rows.map((r: any) => ({
      following_id: r.following_id,
      created_at: r.created_at,
      following: profileMap.get(r.following_id) ?? null,
    }))

    return jsonResponse({
      data: result,
      page,
      pageSize: limit,
      hasMore: result.length === limit,
    })
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch following', 500)
  }
}
