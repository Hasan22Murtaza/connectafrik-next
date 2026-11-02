import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  FamilyAuthError,
  buildActivitySummary,
  getActiveMembership,
  requireParentOfMember,
} from '@/lib/family'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7', 10) || 7, 1), 90)

    const membership = await getActiveMembership(supabase, user.id)
    const { data: target } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!target) return errorResponse('Member not found', 404)

    const isSelf = target.user_id === user.id
    const isParent =
      membership?.role === 'parent' &&
      membership.status === 'active' &&
      membership.family_id === target.family_id

    if (!isSelf && !isParent) {
      return errorResponse('Forbidden', 403)
    }

    // Parents get full summary; self can see own aggregate counts only.
    if (!isSelf) {
      await requireParentOfMember(supabase, user.id, id)
    }

    const periodEnd = new Date()
    const periodStart = new Date(periodEnd.getTime() - days * 24 * 60 * 60 * 1000)
    const summary = await buildActivitySummary(supabase, id, periodStart, periodEnd)

    // Never expose message content — summary is counts only.
    return jsonResponse(summary)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load activity'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    if (error instanceof FamilyAuthError) {
      return errorResponse(error.message, error.status)
    }
    return errorResponse(message, 500)
  }
}
