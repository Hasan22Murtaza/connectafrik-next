import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import {
  canModerateGroupContent,
  isGroupPostModerationAction,
  type GroupPostModerationAction,
} from '@/lib/groups/roles'

type RouteContext = { params: Promise<{ id: string; postId: string }> }

const ACTION_UPDATES: Record<GroupPostModerationAction, Record<string, unknown>> = {
  hide: { is_hidden: true },
  unhide: { is_hidden: false },
  restrict: { is_restricted: true },
  unrestrict: { is_restricted: false },
  approve: { moderation_status: 'approved', is_hidden: false },
  reject: { moderation_status: 'rejected' },
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: groupId, postId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()
    const body = await request.json().catch(() => ({}))
    const action = body?.action

    if (!isGroupPostModerationAction(action)) {
      return errorResponse(
        'action must be one of: hide, unhide, restrict, unrestrict, approve, reject',
        400
      )
    }

    const { data: actorMembership, error: actorError } = await serviceClient
      .from('group_memberships')
      .select('id, role, status')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (actorError) return errorResponse(actorError.message, 400)
    if (!actorMembership || !canModerateGroupContent(actorMembership.role)) {
      return forbiddenResponse('Only managers, co-admins, and admins can moderate group posts')
    }

    const { data: post, error: postError } = await serviceClient
      .from('group_posts')
      .select('id, group_id, is_deleted')
      .eq('id', postId)
      .eq('group_id', groupId)
      .maybeSingle()

    if (postError) return errorResponse(postError.message, 400)
    if (!post || post.is_deleted) return errorResponse('Post not found', 404)

    const { data: updated, error: updateError } = await serviceClient
      .from('group_posts')
      .update(ACTION_UPDATES[action])
      .eq('id', postId)
      .select()
      .maybeSingle()

    if (updateError) return errorResponse(updateError.message, 400)

    return jsonResponse({ data: updated, action })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to moderate post', 500)
  }
}
