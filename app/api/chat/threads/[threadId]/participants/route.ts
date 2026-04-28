import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { requireChatThreadAccess } from '@/lib/chatThreadAccess'

export async function GET(request: NextRequest, context: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await context.params
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const allowed = await requireChatThreadAccess(serviceClient, user.id, threadId)
    if (!allowed) {
      return errorResponse('Thread not found or access denied', 404)
    }

    const excludeUserId = request.nextUrl.searchParams.get('exclude_user_id')

    let query = serviceClient
      .from('chat_participants')
      .select('user_id')
      .eq('thread_id', threadId)

    if (excludeUserId) {
      query = query.neq('user_id', excludeUserId)
    }

    const { data: participants, error } = await query

    if (error) {
      return errorResponse(error.message, 400)
    }

    return jsonResponse({ data: participants || [] })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Internal server error', 500)
  }
}
