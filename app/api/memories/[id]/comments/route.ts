import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const COMMENT_SELECT = `
  *,
  profiles!reel_comments_user_id_fkey(username, full_name, avatar_url)
`

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reelId } = await params
    const supabase = createServiceClient()

    const { data: topLevel, error: topError } = await supabase
      .from('reel_comments')
      .select(COMMENT_SELECT)
      .eq('reel_id', reelId)
      .is('parent_id', null)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })

    if (topError) return errorResponse(topError.message, 400)
    const comments = topLevel ?? []
    if (comments.length === 0) return jsonResponse({ data: [] })

    const parentIds = comments.map((c: { id: string }) => c.id)
    const { data: replies, error: repliesError } = await supabase
      .from('reel_comments')
      .select(COMMENT_SELECT)
      .eq('reel_id', reelId)
      .in('parent_id', parentIds)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })

    if (repliesError) return errorResponse(repliesError.message, 400)
    const repliesList = replies ?? []
    const repliesByParent = new Map<string, unknown[]>()
    for (const r of repliesList) {
      const pid = (r as { parent_id: string }).parent_id
      if (!repliesByParent.has(pid)) repliesByParent.set(pid, [])
      repliesByParent.get(pid)!.push(r)
    }

    const data = comments.map((c: { id: string }) => ({
      ...c,
      replies: repliesByParent.get(c.id) ?? [],
    }))
    return jsonResponse({ data })
  } catch (error: unknown) {
    const err = error as { message?: string }
    return errorResponse(err.message || 'Failed to fetch comments', 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reelId } = await params
    const { user } = await getAuthenticatedUser(request)
    const supabase = createServiceClient()
    const body = await request.json()
    const { content, parent_id } = body

    if (!content) return errorResponse('content is required', 400)

    const { data: comment, error } = await supabase
      .from('reel_comments')
      .insert({
        reel_id: reelId,
        user_id: user.id,
        content,
        parent_id: parent_id ?? null,
      })
      .select(COMMENT_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ data: comment }, 201)
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(err.message || 'Failed to add comment', 500)
  }
}
