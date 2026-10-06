import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chat/chatThreadAccess'
import { isChatAdminRole, isChatThreadAdmin } from '@/lib/chat/chatThreadAdmin'

type RouteContext = { params: Promise<{ threadId: string }> }

const ALLOWED_ROLES = new Set(['admin', 'member'])

/**
 * POST /api/chat/threads/:threadId/participants/role
 * Body: { user_id: string, role: 'admin' | 'member' }
 *
 * Admin-only: promote a member to admin, or dismiss an admin back to member.
 * The last remaining admin cannot be demoted.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const actorIsAdmin = await isChatThreadAdmin(serviceClient, user.id, threadId)
    if (!actorIsAdmin) {
      return errorResponse('Only group admins can change roles', 403)
    }

    const body = await request.json().catch(() => ({}))
    const targetUserId =
      typeof body?.user_id === 'string' ? body.user_id.trim() : ''
    const nextRole =
      typeof body?.role === 'string' ? body.role.trim().toLowerCase() : ''

    if (!targetUserId) {
      return errorResponse('user_id is required', 400)
    }
    if (!ALLOWED_ROLES.has(nextRole)) {
      return errorResponse("role must be 'admin' or 'member'", 400)
    }

    const { data: targetRow, error: targetErr } = await serviceClient
      .from('chat_participants')
      .select('user_id, role')
      .eq('thread_id', threadId)
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (targetErr) return errorResponse(targetErr.message, 400)
    if (!targetRow) {
      return errorResponse('User is not a participant in this thread', 404)
    }

    const currentRole = (targetRow.role || 'member').toLowerCase()
    if (currentRole === nextRole) {
      return jsonResponse({
        success: true,
        user_id: targetUserId,
        role: nextRole,
        unchanged: true,
      })
    }

    // Prevent demoting the last admin (including self)
    if (isChatAdminRole(currentRole) && nextRole === 'member') {
      const { data: adminRows, error: adminErr } = await serviceClient
        .from('chat_participants')
        .select('user_id, role')
        .eq('thread_id', threadId)

      if (adminErr) return errorResponse(adminErr.message, 400)

      const adminCount = (adminRows || []).filter((row) =>
        isChatAdminRole(row.role)
      ).length

      if (adminCount <= 1) {
        return errorResponse(
          'Cannot dismiss the last admin. Assign another admin first.',
          400
        )
      }
    }

    const { error: updateErr } = await serviceClient
      .from('chat_participants')
      .update({ role: nextRole })
      .eq('thread_id', threadId)
      .eq('user_id', targetUserId)

    if (updateErr) return errorResponse(updateErr.message, 400)

    return jsonResponse({
      success: true,
      user_id: targetUserId,
      role: nextRole,
      thread_id: threadId,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(err.message || 'Failed to update role', 500)
  }
}
