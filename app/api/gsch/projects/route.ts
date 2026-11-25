import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { GSCH_PROJECT_SELECT } from '@/lib/gsch/selects'
import type { GschProjectCategory, GschProjectStage } from '@/shared/types/gsch'

const CATEGORIES: GschProjectCategory[] = [
  'renewable_energy',
  'infrastructure',
  'real_estate',
  'transportation',
  'agriculture',
  'manufacturing',
  'technology',
  'tourism',
  'water_management',
]

const STAGES: GschProjectStage[] = [
  'concept',
  'feasibility',
  'development',
  'funding',
  'construction',
  'operational',
  'completed',
]

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
  }
  return []
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)

    const q = searchParams.get('q')?.trim() || ''
    const category = searchParams.get('category')?.trim() || ''
    const country = searchParams.get('country')?.trim() || ''
    const continent = searchParams.get('continent')?.trim() || ''
    const stage = searchParams.get('stage')?.trim() || ''
    const saved = searchParams.get('saved') === '1'
    const mine = searchParams.get('mine') === '1'
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1),
      50
    )
    const from = page * limit
    const to = from + limit - 1

    let savedProjectIds: string[] | null = null
    if (saved) {
      const { data: saves } = await supabase
        .from('gsch_project_saves')
        .select('project_id')
        .eq('user_id', user.id)
      savedProjectIds = (saves || []).map((s) => s.project_id)
      if (savedProjectIds.length === 0) {
        return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
      }
    }

    let query = supabase
      .from('gsch_projects')
      .select(GSCH_PROJECT_SELECT)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (savedProjectIds) {
      query = query.in('id', savedProjectIds)
    } else if (mine) {
      const { data: memberships } = await supabase
        .from('gsch_memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
      const orgIds = (memberships || []).map((m) => m.organization_id)
      if (orgIds.length === 0) {
        return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
      }
      query = query.in('organization_id', orgIds)
    } else {
      query = query.eq('is_published', true)
    }

    if (category) query = query.eq('category', category)
    if (country) query = query.ilike('country', `%${country}%`)
    if (continent) query = query.ilike('continent', `%${continent}%`)
    if (stage) query = query.eq('project_stage', stage)
    if (q) {
      query = query.or(
        `title.ilike.%${q}%,description.ilike.%${q}%,location_label.ilike.%${q}%`
      )
    }

    const { data, error } = await query
    if (error) return errorResponse(error.message, 400)

    const projectIds = (data || []).map((p: any) => p.id)
    let savedSet = new Set<string>()
    if (projectIds.length > 0) {
      const { data: userSaves } = await supabase
        .from('gsch_project_saves')
        .select('project_id')
        .eq('user_id', user.id)
        .in('project_id', projectIds)
      savedSet = new Set((userSaves || []).map((s) => s.project_id))
    }

    const enriched = (data || []).map((row: any) => ({
      ...row,
      is_saved: savedSet.has(row.id),
    }))

    return jsonResponse({
      data: enriched,
      page,
      pageSize: limit,
      hasMore: (data || []).length === limit,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load projects', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    if (!body.organization_id) return errorResponse('organization_id is required', 400)
    if (!body.title?.trim()) return errorResponse('title is required', 400)
    if (!CATEGORIES.includes(body.category)) {
      return errorResponse('Invalid category', 400)
    }
    if (body.project_stage && !STAGES.includes(body.project_stage)) {
      return errorResponse('Invalid project_stage', 400)
    }
    if (!body.disclaimer_acknowledged) {
      return errorResponse(
        'You must acknowledge the investment marketplace disclaimer.',
        400
      )
    }

    const authz = await requireOrgRole(
      supabase,
      body.organization_id,
      user.id,
      'representative'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const { data, error } = await supabase
      .from('gsch_projects')
      .insert({
        organization_id: body.organization_id,
        city_id: body.city_id || null,
        title: String(body.title).trim(),
        description: body.description?.trim() || null,
        category: body.category,
        location_label: body.location_label?.trim() || null,
        country: body.country?.trim() || null,
        continent: body.continent?.trim() || null,
        estimated_value_amount: parseOptionalNumber(body.estimated_value_amount),
        estimated_value_currency: body.estimated_value_currency?.trim() || 'USD',
        funding_required_amount: parseOptionalNumber(body.funding_required_amount),
        funding_required_currency: body.funding_required_currency?.trim() || 'USD',
        investment_structure: body.investment_structure?.trim() || null,
        project_stage: body.project_stage || 'concept',
        required_partners: parseStringArray(body.required_partners),
        document_urls: parseStringArray(body.document_urls),
        contact_email: body.contact_email?.trim() || null,
        contact_name: body.contact_name?.trim() || null,
        verification_status: 'unverified',
        is_published: Boolean(body.is_published),
        disclaimer_acknowledged: true,
        created_by: user.id,
      })
      .select(GSCH_PROJECT_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'project_created',
      entity_type: 'gsch_project',
      entity_id: data.id,
      metadata: {
        title: data.title,
        category: data.category,
        is_published: data.is_published,
      },
    })

    return jsonResponse({ ...data, is_saved: false }, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create project', 500)
  }
}
