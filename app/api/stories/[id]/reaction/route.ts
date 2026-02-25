import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: storyId } = await context.params
    const { supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 100)
    const from = page * limit
    const to = from + limit - 1

    const { data: reactions, error } = await supabase
      .from('story_reactions')
      .select('id, story_id, user_id, reaction_type, created_at')
      .eq('story_id', storyId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return errorResponse(error.message, 400)
    if (!reactions || reactions.length === 0) {
      return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
    }

    const userIds = [...new Set(reactions.map((r: any) => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds)

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

    const result = reactions.map((r: any) => {
      const profile = profileMap.get(r.user_id) as any
      return {
        id: r.id,
        story_id: r.story_id,
        user_id: r.user_id,
        reaction_type: r.reaction_type,
        created_at: r.created_at,
        user_name: profile?.full_name || 'Unknown',
        user_avatar: profile?.avatar_url || '',
      }
    })

    return jsonResponse({
      data: result,
      page,
      pageSize: limit,
      hasMore: result.length === limit,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch reactions', 500)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: storyId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)
    const { reaction_type } = await request.json()

    const { data, error } = await supabase
      .from('story_reactions')
      .upsert(
        {
          story_id: storyId,
          user_id: user.id,
          reaction_type: reaction_type || 'like',
          created_at: new Date().toISOString(),
        },
        { onConflict: 'story_id,user_id' }
      )
      .select('id, story_id, user_id, reaction_type, created_at')
      .single()

    if (error) return errorResponse(error.message, 400)

    return jsonResponse({ data })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to add reaction', 500)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: storyId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { error } = await supabase
      .from('story_reactions')
      .delete()
      .eq('story_id', storyId)
      .eq('user_id', user.id)

    if (error) return errorResponse(error.message, 400)

    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to remove reaction', 500)
  }
}
