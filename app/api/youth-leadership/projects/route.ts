import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import {
  checkYouthLeadershipAccess,
  requireOrgRole,
} from '@/lib/youth-leadership/auth'

const PROJECT_LIST_SELECT = `
  id, title, description, objective, status, skills_required, max_participants,
  organization_id, created_by, start_date, end_date, created_at,
  organization:youth_organizations!organization_id(id, name, logo_url)
`

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const access = await checkYouthLeadershipAccess(supabase, user.id)
    if (!access.allowed) {
      return errorResponse(access.message || 'Access restricted', 403, {
        code: access.code,
      })
    }

    const { searchParams } = new URL(request.url)
    const mine = searchParams.get('mine') === '1'
    const status = searchParams.get('status')
    const orgId = searchParams.get('organization_id')
    const search = searchParams.get('search')?.trim() || ''
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '40', 10) || 40, 1),
      50
    )
    const from = page * limit
    const to = from + limit - 1

    let query = supabase
      .from('youth_projects')
      .select(PROJECT_LIST_SELECT)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (mine) {
      const { data: memberships } = await supabase
        .from('youth_project_members')
        .select('project_id')
        .eq('user_id', user.id)
        .in('status', ['invited', 'active', 'completed'])
      const memberIds = (memberships || []).map((m) => m.project_id)
      // Include created by me or member of
      query = query.or(
        `created_by.eq.${user.id}${memberIds.length ? `,id.in.(${memberIds.join(',')})` : ''}`
      )
    } else if (orgId) {
      const authz = await requireOrgRole(supabase, orgId, user.id, 'viewer')
      if (!authz.ok) return forbiddenResponse(authz.message)
      query = query.eq('organization_id', orgId)
      if (status) query = query.eq('status', status)
    } else {
      // Public list: approved/active, plus the viewer's own drafts/pending so creates stay visible
      query = query.or(
        `status.in.(approved,active),and(created_by.eq.${user.id},status.in.(draft,pending_approval,approved,active,completed))`
      )
      if (status && ['approved', 'active', 'completed'].includes(status)) {
        query = query.eq('status', status)
      }
    }

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,objective.ilike.%${search}%`
      )
    }

    const { data, error } = await query
    if (error) return errorResponse(error.message, 400)

    const projects = data || []
    const ids = projects.map((p) => p.id)
    let myMembership = new Map<string, any>()
    let counts = new Map<string, number>()

    if (ids.length > 0) {
      const [{ data: members }, { data: myMembers }] = await Promise.all([
        supabase
          .from('youth_project_members')
          .select('project_id')
          .in('project_id', ids)
          .in('status', ['active', 'invited']),
        supabase
          .from('youth_project_members')
          .select('id, project_id, user_id, role, status')
          .eq('user_id', user.id)
          .in('project_id', ids),
      ])
      for (const m of members || []) {
        counts.set(m.project_id, (counts.get(m.project_id) || 0) + 1)
      }
      for (const m of myMembers || []) myMembership.set(m.project_id, m)
    }

    const enriched = projects.map((p) => ({
      ...p,
      member_count: counts.get(p.id) || 0,
      my_membership: myMembership.get(p.id) || null,
    }))

    // Keep array response for existing callers; pagination meta is additive via header-like fields
    // when clients opt into page/limit (backward compatible: still returns the list array).
    return jsonResponse(enriched)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load projects', 500)
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
    if (!body.title?.trim()) return errorResponse('title is required', 400)

    const organizationId = body.organization_id ?? null
    if (organizationId) {
      const authz = await requireOrgRole(supabase, organizationId, user.id, 'coordinator')
      if (!authz.ok) return forbiddenResponse(authz.message)
    }

    const payload = {
      organization_id: organizationId,
      program_id: body.program_id ?? null,
      title: String(body.title).trim(),
      description: body.description ?? null,
      objective: body.objective ?? null,
      skills_required: Array.isArray(body.skills_required) ? body.skills_required : null,
      max_participants: body.max_participants ?? null,
      status: body.status === 'pending_approval' ? 'pending_approval' : 'draft',
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
      milestones: Array.isArray(body.milestones) ? body.milestones : [],
      created_by: user.id,
    }

    const { data, error } = await supabase
      .from('youth_projects')
      .insert(payload)
      .select(PROJECT_LIST_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    // Bootstrap creator as coordinator member
    await supabase.from('youth_project_members').insert({
      project_id: data.id,
      user_id: user.id,
      role: 'coordinator',
      status: 'active',
      joined_at: new Date().toISOString(),
    })

    return jsonResponse({ ...data, member_count: 1, my_membership: { role: 'coordinator', status: 'active' } }, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create project', 500)
  }
}
