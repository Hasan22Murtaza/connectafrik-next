import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params
    if (!sessionId || !UUID_RE.test(sessionId)) {
      return errorResponse('Invalid session id', 400)
    }

    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const { data, error } = await serviceClient.rpc('revoke_user_auth_session', {
      p_user_id: user.id,
      p_session_id: sessionId,
    })

    if (error) {
      return errorResponse(error.message || 'Failed to revoke session', 500)
    }

    if (data !== true) {
      return errorResponse('Session not found', 404)
    }

    await serviceClient
      .from('auth_session_device_labels')
      .delete()
      .eq('user_id', user.id)
      .eq('session_id', sessionId)

    return jsonResponse({ revoked: true })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') return unauthorizedResponse()
    const message = err instanceof Error ? err.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
