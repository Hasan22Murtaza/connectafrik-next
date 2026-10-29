import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { FamilyAuthError, getActiveMembership, requireParentOfFamily } from '@/lib/family'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const membership = await getActiveMembership(supabase, user.id)

    if (!membership || membership.family_id !== id) {
      return errorResponse('Family not found', 404)
    }

    const { data: family, error } = await supabase
      .from('families')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !family) {
      return errorResponse('Family not found', 404)
    }

    return jsonResponse({ family, membership })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load family'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
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
    await requireParentOfFamily(supabase, user.id, id)

    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}

    if (typeof body?.name === 'string') {
      const name = body.name.trim()
      if (!name || name.length > 80) {
        return errorResponse('Family name is required (max 80 characters)', 400)
      }
      updates.name = name
    }

    if (body?.status === 'active' || body?.status === 'archived') {
      updates.status = body.status
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data, error } = await supabase
      .from('families')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error || !data) {
      return errorResponse(error?.message || 'Failed to update family', 400)
    }

    return jsonResponse(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update family'
    if (message === 'Unauthorized' || message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    if (error instanceof FamilyAuthError) {
      return errorResponse(error.message, error.status)
    }
    return errorResponse(message, 500)
  }
}
