import { NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { FamilyAuthError, isManagedRole, requireParentOfMember } from '@/lib/family'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const { target } = await requireParentOfMember(supabase, user.id, id)

    if (!isManagedRole(target.role)) {
      return jsonResponse([])
    }

    const service = createServiceClient()
    const { data: requests, error } = await service
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status, created_at, updated_at')
      .eq('receiver_id', target.user_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error.message, 400)

    const senderIds = (requests || []).map((r) => r.sender_id)
    const { data: profiles } = await service
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', senderIds.length ? senderIds : ['00000000-0000-0000-0000-000000000000'])

    const map = new Map((profiles || []).map((p) => [p.id, p]))
    return jsonResponse(
      (requests || []).map((r) => ({
        ...r,
        sender: map.get(r.sender_id) || null,
      }))
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list friend requests'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    if (error instanceof FamilyAuthError) {
      return errorResponse(error.message, error.status)
    }
    return errorResponse(message, 500)
  }
}
