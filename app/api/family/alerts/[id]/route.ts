import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { FamilyAuthError, requireParentOfMember } from '@/lib/family'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const { data: alert, error } = await supabase
      .from('safety_alerts')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !alert) return errorResponse('Alert not found', 404)

    await requireParentOfMember(supabase, user.id, alert.family_member_id)
    return jsonResponse(alert)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load alert'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    if (error instanceof FamilyAuthError) {
      return errorResponse(error.message, error.status)
    }
    return errorResponse(message, 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))

    const { data: alert, error } = await supabase
      .from('safety_alerts')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !alert) return errorResponse('Alert not found', 404)

    await requireParentOfMember(supabase, user.id, alert.family_member_id)

    const status = body?.status
    if (!['acknowledged', 'resolved', 'dismissed', 'open'].includes(status)) {
      return errorResponse('status must be open, acknowledged, resolved, or dismissed', 400)
    }

    const updates: Record<string, unknown> = { status }
    if (status === 'resolved' || status === 'dismissed') {
      updates.resolved_at = new Date().toISOString()
    } else if (status === 'open') {
      updates.resolved_at = null
    }

    const { data, error: updateError } = await supabase
      .from('safety_alerts')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) return errorResponse(updateError.message, 400)
    return jsonResponse(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update alert'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    if (error instanceof FamilyAuthError) {
      return errorResponse(error.message, error.status)
    }
    return errorResponse(message, 500)
  }
}
