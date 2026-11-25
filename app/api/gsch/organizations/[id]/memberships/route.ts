import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import type { GschOrgMemberRole } from '@/shared/types/gsch'

type Params = { params: Promise<{ id: string }> }

const ROLES: GschOrgMemberRole[] = ['owner', 'admin', 'representative', 'member']

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)

    const authz = await requireOrgRole(supabase, id, user.id, 'member')
    if (!authz.ok) return forbiddenResponse(authz.message)

    const { data, error } = await supabase
      .from('gsch_memberships')
      .select(
        `
        id, organization_id, user_id, role, status, created_at, updated_at,
        profile:profiles!user_id(id, username, full_name, avatar_url)
      `
      )
      .eq('organization_id', id)
      .neq('status', 'removed')
      .order('created_at', { ascending: true })

    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data || [])
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load memberships', 500)
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const authz = await requireOrgRole(supabase, id, user.id, 'admin')
    if (!authz.ok) return forbiddenResponse(authz.message)

    const targetUserId = body.user_id?.trim()
    if (!targetUserId) return errorResponse('user_id is required', 400)

    const role: GschOrgMemberRole = ROLES.includes(body.role) ? body.role : 'member'
    if (role === 'owner' && authz.membership.role !== 'owner') {
      return forbiddenResponse('Only owners can assign the owner role.')
    }

    const { data: existing } = await supabase
      .from('gsch_memberships')
      .select('id, status')
      .eq('organization_id', id)
      .eq('user_id', targetUserId)
      .maybeSingle()

    let row
    if (existing) {
      const { data, error } = await supabase
        .from('gsch_memberships')
        .update({
          role,
          status: body.status === 'invited' ? 'invited' : 'active',
        })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) return errorResponse(error.message, 400)
      row = data
    } else {
      const { data, error } = await supabase
        .from('gsch_memberships')
        .insert({
          organization_id: id,
          user_id: targetUserId,
          role,
          status: body.status === 'invited' ? 'invited' : 'active',
        })
        .select('*')
        .single()
      if (error) return errorResponse(error.message, 400)
      row = data
    }

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'membership_added',
      entity_type: 'gsch_membership',
      entity_id: row.id,
      metadata: { organization_id: id, user_id: targetUserId, role },
    })

    return jsonResponse(row, existing ? 200 : 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to add membership', 500)
  }
}
