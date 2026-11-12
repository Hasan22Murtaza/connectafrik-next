import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { errorResponse, jsonResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  checkYouthLeadershipAccess,
  writeYouthAuditLog,
} from '@/lib/youth-leadership/auth'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const { data: memberships, error: memError } = await supabase
      .from('youth_organization_members')
      .select('organization_id, role, status')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (memError) return errorResponse(memError.message, 400)

    const orgIds = (memberships || []).map((m) => m.organization_id)
    if (orgIds.length === 0) return jsonResponse([])

    const { data, error } = await supabase
      .from('youth_organizations')
      .select('*')
      .in('id', orgIds)
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error.message, 400)

    const roleByOrg = new Map(
      (memberships || []).map((m) => [m.organization_id, m.role])
    )
    const enriched = (data || []).map((org) => ({
      ...org,
      my_role: roleByOrg.get(org.id) || null,
    }))

    return jsonResponse(enriched)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load organizations', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const body = await request.json()
    if (!body.name?.trim()) {
      return errorResponse('name is required', 400)
    }

    const { data: org, error } = await supabase
      .from('youth_organizations')
      .insert({
        name: String(body.name).trim(),
        description: body.description ?? null,
        logo_url: body.logo_url ?? null,
        website: body.website ?? null,
        country: body.country ?? null,
        region: body.region ?? null,
        created_by: user.id,
        verification_status: 'pending',
      })
      .select('*')
      .single()

    if (error) return errorResponse(error.message, 400)

    const { error: memberError } = await supabase
      .from('youth_organization_members')
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: 'admin',
        status: 'active',
      })

    if (memberError) return errorResponse(memberError.message, 400)

    await writeYouthAuditLog(supabase, {
      actor_id: user.id,
      action: 'organization_created',
      entity_type: 'youth_organization',
      entity_id: org.id,
      metadata: { name: org.name },
    })

    return jsonResponse({ ...org, my_role: 'admin' }, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create organization', 500)
  }
}
