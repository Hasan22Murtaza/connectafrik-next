import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { FamilyAuthError, getActiveMembership } from '@/lib/family'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const membership = await getActiveMembership(supabase, user.id)

    if (!membership || membership.role !== 'parent') {
      return errorResponse('Only parents can list family safety alerts', 403)
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const memberId = searchParams.get('member_id')

    const { data: members } = await supabase
      .from('family_members')
      .select('id')
      .eq('family_id', membership.family_id)
      .neq('status', 'removed')

    const memberIds = (members || []).map((m) => m.id)
    if (memberIds.length === 0) return jsonResponse([])

    let query = supabase
      .from('safety_alerts')
      .select('*')
      .in('family_member_id', memberIds)
      .order('created_at', { ascending: false })
      .limit(100)

    if (status) query = query.eq('status', status)
    if (memberId) {
      if (!memberIds.includes(memberId)) {
        return errorResponse('Forbidden', 403)
      }
      query = query.eq('family_member_id', memberId)
    }

    const { data, error } = await query
    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data || [])
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list alerts'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    if (error instanceof FamilyAuthError) {
      return errorResponse(error.message, error.status)
    }
    return errorResponse(message, 500)
  }
}
