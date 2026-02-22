import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId } = await context.params
    let userId: string | null = null
    let supabase

    try {
      const auth = await getAuthenticatedUser(request)
      userId = auth.user.id
      supabase = auth.supabase
    } catch {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    }

    const { data: reactionsData, error } = await supabase
      .from('post_reactions')
      .select('id, post_id, user_id, reaction_type, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: false })

    if (error) {
      return errorResponse(error.message, 400)
    }

    const rows = reactionsData || []
    const userIds = [...new Set(rows.map((r: any) => r.user_id))]

    let profileMap = new Map<string, any>()
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', userIds)

      if (profiles) {
        profileMap = new Map(profiles.map((p: any) => [p.id, p]))
      }
    }

    const groups: Record<string, { type: string; count: number; users: any[]; currentUserReacted: boolean }> = {}
    let totalCount = 0

    rows.forEach((r: any) => {
      if (!groups[r.reaction_type]) {
        groups[r.reaction_type] = { type: r.reaction_type, count: 0, users: [], currentUserReacted: false }
      }
      groups[r.reaction_type].count++
      totalCount++

      const profile = profileMap.get(r.user_id)
      if (profile && !groups[r.reaction_type].users.find((u: any) => u.id === profile.id)) {
        groups[r.reaction_type].users.push(profile)
      }

      if (userId && r.user_id === userId) {
        groups[r.reaction_type].currentUserReacted = true
      }
    })

    return jsonResponse({ data: groups, totalCount })
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to fetch reactions', 500)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)
    const { reaction_type } = await request.json()

    if (!reaction_type) {
      return errorResponse('reaction_type is required', 400)
    }

    // Check for existing reaction
    const { data: existing, error: checkError } = await supabase
      .from('post_reactions')
      .select('id, reaction_type')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (checkError) return errorResponse(checkError.message, 400)

    // Toggle off: same reaction exists
    if (existing && existing.reaction_type === reaction_type) {
      const { error: deleteError } = await supabase
        .from('post_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .eq('reaction_type', reaction_type)

      if (deleteError) return errorResponse(deleteError.message, 400)

      // Decrement likes_count
      const { data: post } = await supabase
        .from('posts')
        .select('likes_count')
        .eq('id', postId)
        .single()

      if (post) {
        await supabase
          .from('posts')
          .update({ likes_count: Math.max(0, (post.likes_count || 0) - 1) })
          .eq('id', postId)
      }

      return jsonResponse({ action: 'removed', reaction_type })
    }

    // Update: different reaction exists
    if (existing) {
      const { error: updateError } = await supabase
        .from('post_reactions')
        .update({ reaction_type })
        .eq('post_id', postId)
        .eq('user_id', user.id)

      if (updateError) return errorResponse(updateError.message, 400)

      return jsonResponse({ action: 'updated', reaction_type })
    }

    // Insert new reaction
    const { error: insertError } = await supabase
      .from('post_reactions')
      .insert({ post_id: postId, user_id: user.id, reaction_type })

    if (insertError) return errorResponse(insertError.message, 400)

    // Increment likes_count
    const { data: post } = await supabase
      .from('posts')
      .select('likes_count')
      .eq('id', postId)
      .single()

    if (post) {
      await supabase
        .from('posts')
        .update({ likes_count: (post.likes_count || 0) + 1 })
        .eq('id', postId)
    }

    return jsonResponse({ action: 'added', reaction_type })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to handle reaction', 500)
  }
}
