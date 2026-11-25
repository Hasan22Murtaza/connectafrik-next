import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { notifyGschOrgOwners } from '@/lib/gsch/notify'
import { GSCH_CLIMATE_INTEREST_SELECT } from '@/lib/gsch/selects'
import type { GschClimateInterestType } from '@/shared/types/gsch'

const INTEREST_TYPES: GschClimateInterestType[] = [
  'technical_partner',
  'financial_partner',
  'research',
  'general',
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params

    const { data: project, error: loadError } = await supabase
      .from('gsch_climate_projects')
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!project) return errorResponse('Climate project not found', 404)

    const authz = await requireOrgRole(
      supabase,
      project.organization_id,
      user.id,
      'member'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const { searchParams } = new URL(request.url)
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1),
      50
    )
    const from = page * limit
    const to = from + limit - 1

    const { data, error } = await supabase
      .from('gsch_climate_interest')
      .select(GSCH_CLIMATE_INTEREST_SELECT)
      .eq('climate_project_id', id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return errorResponse(error.message, 400)

    return jsonResponse({
      data: data || [],
      page,
      pageSize: limit,
      hasMore: (data || []).length === limit,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load interest expressions', 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const body = await request.json()

    const interestType: GschClimateInterestType = INTEREST_TYPES.includes(
      body.interest_type
    )
      ? body.interest_type
      : 'general'

    const { data: project, error: loadError } = await supabase
      .from('gsch_climate_projects')
      .select('id, organization_id, title, is_published')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!project) return errorResponse('Climate project not found', 404)
    if (!project.is_published) {
      return errorResponse('Project is not published', 400)
    }

    if (body.organization_id) {
      const authz = await requireOrgRole(
        supabase,
        body.organization_id,
        user.id,
        'member'
      )
      if (!authz.ok) return forbiddenResponse(authz.message)
    }

    const { data, error } = await supabase
      .from('gsch_climate_interest')
      .insert({
        climate_project_id: id,
        organization_id: body.organization_id || null,
        applicant_user_id: user.id,
        interest_type: interestType,
        message: body.message?.trim() || null,
        status: 'submitted',
      })
      .select(GSCH_CLIMATE_INTEREST_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'climate_interest_created',
      entity_type: 'gsch_climate_interest',
      entity_id: data.id,
      metadata: { climate_project_id: id, interest_type: interestType },
    })

    await notifyGschOrgOwners(supabase, project.organization_id, {
      type: 'gsch_climate_interest',
      title: 'Climate partnership interest',
      message: `Someone expressed interest in “${project.title}”.`,
      data: {
        climate_project_id: id,
        interest_id: data.id,
        type: 'gsch_climate_interest',
      },
      excludeUserId: user.id,
    })

    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to express interest', 500)
  }
}
