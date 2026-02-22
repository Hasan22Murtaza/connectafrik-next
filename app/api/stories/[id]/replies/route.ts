import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: storyId } = await context.params
    const { supabase } = await getAuthenticatedUser(request)

    const { data: replies, error } = await supabase
      .from('story_replies')
      .select('id, story_id, author_id, content, created_at')
      .eq('story_id', storyId)
      .order('created_at', { ascending: true })

    if (error) return errorResponse(error.message, 400)
    if (!replies || replies.length === 0) return jsonResponse({ data: [] })

    const authorIds = [...new Set(replies.map((r: any) => r.author_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', authorIds)

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

    const result = replies.map((reply: any) => {
      const profile = profileMap.get(reply.author_id) as any
      return {
        id: reply.id,
        story_id: reply.story_id,
        author_id: reply.author_id,
        content: reply.content,
        created_at: reply.created_at,
        author_name: profile?.full_name || 'Unknown',
        author_avatar: profile?.avatar_url || '',
      }
    })

    return jsonResponse({ data: result })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch replies', 500)
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: storyId } = await context.params
    const { user, supabase } = await getAuthenticatedUser(request)
    const { content } = await request.json()

    if (!content?.trim()) {
      return errorResponse('content is required', 400)
    }

    const { data, error } = await supabase
      .from('story_replies')
      .insert({ story_id: storyId, author_id: user.id, content })
      .select('id, story_id, author_id, content, created_at')
      .single()

    if (error) return errorResponse(error.message, 400)

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single()

    return jsonResponse({
      data: {
        ...data,
        author_name: profile?.full_name || 'Unknown',
        author_avatar: profile?.avatar_url || '',
      },
    }, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to add reply', 500)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const replyId = searchParams.get('replyId')

    if (!replyId) {
      return errorResponse('replyId query param is required', 400)
    }

    const { error } = await supabase
      .from('story_replies')
      .delete()
      .eq('id', replyId)

    if (error) return errorResponse(error.message, 400)

    return jsonResponse({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to delete reply', 500)
  }
}
