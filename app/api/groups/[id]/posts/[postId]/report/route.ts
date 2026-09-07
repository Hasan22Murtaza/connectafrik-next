import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { isPostReportReason } from '@/lib/reports/reportService'

type RouteContext = { params: Promise<{ id: string; postId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId, postId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json().catch(() => ({}))
    const reason = body?.reason
    const details = typeof body?.details === 'string' ? body.details.trim().slice(0, 500) : null

    if (!isPostReportReason(reason)) {
      return errorResponse('Please select a valid report reason', 400)
    }

    const { data: membership } = await serviceClient
      .from('group_memberships')
      .select('id, status')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!membership) {
      return errorResponse('Only group members can report posts', 403)
    }

    const { data: post } = await serviceClient
      .from('group_posts')
      .select('id, author_id, is_deleted')
      .eq('id', postId)
      .eq('group_id', groupId)
      .maybeSingle()

    if (!post || post.is_deleted) {
      return errorResponse('Post not found', 404)
    }

    if (post.author_id === user.id) {
      return errorResponse('You cannot report your own post', 400)
    }

    const { error: insertError } = await serviceClient.from('group_post_reports').insert({
      group_id: groupId,
      group_post_id: postId,
      reported_by: user.id,
      reason,
      details,
      status: 'pending',
    })

    if (insertError) {
      if (insertError.code === '23505') {
        return errorResponse('You already reported this post for that reason', 409)
      }
      return errorResponse(insertError.message, 400)
    }

    return jsonResponse(
      { submitted: true },
      201,
      "Thanks for reporting. Co-admins will review this complaint."
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to submit report'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(message, 500)
  }
}
