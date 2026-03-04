import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const supabase = createServiceClient()

    const [profileRes, postsRes, commentsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('posts').select('*').eq('author_id', user.id),
      supabase.from('comments').select('*').eq('author_id', user.id),
    ])

    return jsonResponse({
      data: {
        profile: profileRes.data ?? null,
        posts: postsRes.data ?? [],
        comments: commentsRes.data ?? [],
        exported_at: new Date().toISOString(),
      },
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') return unauthorizedResponse()
    return errorResponse(err.message || 'Failed to export data', 500)
  }
}
