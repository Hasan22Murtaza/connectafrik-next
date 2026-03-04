import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ userId: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { userId } = await params
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    let supabase = createClient(supabaseUrl, supabaseAnonKey)
    let currentUserId: string | null = null

    try {
      const { user, supabase: authSupabase } = await getAuthenticatedUser(request)
      currentUserId = user.id
      supabase = authSupabase
    } catch {
      // anonymous access: keep anon client
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('follower_count, following_count')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return errorResponse('User not found', 404)
    }

    const follower_count = profile.follower_count ?? 0
    const following_count = profile.following_count ?? 0

    let is_following = false
    if (currentUserId && currentUserId !== userId) {
      const { data: follow } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('following_id', userId)
        .maybeSingle()
      is_following = !!follow
    }

    return jsonResponse({
      follower_count,
      following_count,
      is_following,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}
