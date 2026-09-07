import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { canViewGroupComplaints } from '@/lib/groups/roles'

type RouteContext = { params: Promise<{ id: string }> }

type ProfilePreview = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const { data: actorMembership, error: actorError } = await serviceClient
      .from('group_memberships')
      .select('id, role, status')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (actorError) return errorResponse(actorError.message, 400)
    if (!actorMembership || !canViewGroupComplaints(actorMembership.role)) {
      return forbiddenResponse('Only co-admins and admins can view complaints')
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100)
    const from = page * limit
    const to = from + limit - 1
    const status = searchParams.get('status') || 'pending'

    let query = serviceClient
      .from('group_post_reports')
      .select(
        'id, group_id, group_post_id, reported_by, reason, details, status, created_at, reviewed_at, reviewed_by'
      )
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: reports, error } = await query
    if (error) return errorResponse(error.message, 400)

    const rows = reports || []
    const reporterIds = rows.map((row) => row.reported_by).filter(Boolean) as string[]
    const postIds = [...new Set(rows.map((row) => row.group_post_id).filter(Boolean))]

    let profileMap = new Map<string, ProfilePreview>()
    if (reporterIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', reporterIds)
      profileMap = new Map((profiles || []).map((profile) => [profile.id, profile as ProfilePreview]))
    }

    const { data: posts } =
      postIds.length > 0
        ? await serviceClient
            .from('group_posts')
            .select('id, title, content, author_id, is_hidden, is_restricted, moderation_status, is_deleted')
            .in('id', postIds)
        : { data: [] as Array<{ id: string }> }

    const postMap = new Map((posts || []).map((post) => [post.id, post]))
    const authorIds = [...new Set((posts || []).map((post: { author_id?: string }) => post.author_id).filter(Boolean))] as string[]

    if (authorIds.length > 0) {
      const { data: authors } = await serviceClient
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', authorIds)
      for (const author of authors || []) {
        profileMap.set(author.id, author as ProfilePreview)
      }
    }

    const merged = rows.map((row) => {
      const post = postMap.get(row.group_post_id) as
        | {
            id: string
            title?: string
            content?: string
            author_id?: string
            is_hidden?: boolean
            is_restricted?: boolean
            moderation_status?: string
            is_deleted?: boolean
          }
        | undefined
      return {
        ...row,
        reporter: row.reported_by
          ? profileMap.get(row.reported_by) || {
              id: row.reported_by,
              username: 'Unknown',
              full_name: 'Unknown User',
              avatar_url: null,
            }
          : null,
        post: post
          ? {
              ...post,
              author: post.author_id ? profileMap.get(post.author_id) || null : null,
            }
          : null,
      }
    })

    return jsonResponse({
      data: merged,
      page,
      pageSize: limit,
      hasMore: rows.length === limit,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch complaints'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}
