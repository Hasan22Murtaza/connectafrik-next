import { NextRequest } from 'next/server'
import { getAuthenticatedUser, createServiceClient } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'

/** Ringing sessions for threads the user is in, excluding sessions they started (for accept UI + poll fallback). */
export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const serviceClient = createServiceClient()

    const { data: parts } = await serviceClient
      .from('chat_participants')
      .select('thread_id')
      .eq('user_id', user.id)

    const threadIds = [...new Set((parts || []).map((p: { thread_id: string }) => p.thread_id).filter(Boolean))]
    if (threadIds.length === 0) {
      return jsonResponse({ sessions: [] })
    }

    const since = new Date(Date.now() - 4 * 60 * 1000).toISOString()

    const { data: rows, error } = await serviceClient
      .from('call_sessions')
      .select('*')
      .in('thread_id', threadIds)
      .in('status', ['ringing', 'initiated'])
      .neq('created_by', user.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) return errorResponse(error.message, 400)

    return jsonResponse({ sessions: rows || [] })
  } catch (e: any) {
    if (e.message === 'Unauthorized' || e.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(e.message || 'Failed to load incoming calls', 500)
  }
}
