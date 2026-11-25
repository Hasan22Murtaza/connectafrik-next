import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import {
  isPlatformGschAdmin,
  requireOrgRole,
  writeGschAuditLog,
} from '@/lib/gsch/auth'
import { GSCH_PROJECT_SELECT } from '@/lib/gsch/selects'
import type {
  GschProjectCategory,
  GschProjectStage,
  GschProjectVerificationStatus,
} from '@/shared/types/gsch'

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const { data, error } = await supabase
      .from('gsch_projects')
      .select(GSCH_PROJECT_SELECT)
      .eq('id', id)
      .maybeSingle()
    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('Project not found', 404)

    const { data: save } = await supabase
      .from('gsch_project_saves')
      .select('id')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    return jsonResponse({ ...data, is_saved: Boolean(save) })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load project', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const body = await request.json()

    const { data: existing, error: loadError } = await supabase
      .from('gsch_projects')
      .select('id, organization_id, verification_status')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Project not found', 404)

    const isAdmin = await isPlatformGschAdmin(supabase, user.id)
    const authz = await requireOrgRole(
      supabase,
      existing.organization_id,
      user.id,
      'representative'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const patch: Record<string, unknown> = {}
    if (body.title != null) patch.title = String(body.title).trim()
    if (body.description != null) patch.description = body.description?.trim() || null
    if (body.category != null) {
      if (!CATEGORIES.includes(body.category)) {
        return errorResponse('Invalid category', 400)
      }
      patch.category = body.category
    }
    if (body.location_label != null) {
      patch.location_label = body.location_label?.trim() || null
    }
    if (body.country != null) patch.country = body.country?.trim() || null
    if (body.continent != null) patch.continent = body.continent?.trim() || null
    if (body.city_id !== undefined) patch.city_id = body.city_id || null
    if (body.estimated_value_amount !== undefined) {
      patch.estimated_value_amount = parseOptionalNumber(body.estimated_value_amount)
    }
    if (body.estimated_value_currency != null) {
      patch.estimated_value_currency = body.estimated_value_currency?.trim() || 'USD'
    }
    if (body.funding_required_amount !== undefined) {
      patch.funding_required_amount = parseOptionalNumber(body.funding_required_amount)
    }
    if (body.funding_required_currency != null) {
      patch.funding_required_currency = body.funding_required_currency?.trim() || 'USD'
    }
    if (body.investment_structure != null) {
      patch.investment_structure = body.investment_structure?.trim() || null
    }
    if (body.project_stage != null) {
      if (!STAGES.includes(body.project_stage)) {
        return errorResponse('Invalid project_stage', 400)
      }
      patch.project_stage = body.project_stage
    }
    if (body.required_partners != null) {
      patch.required_partners = parseStringArray(body.required_partners)
    }
    if (body.document_urls != null) {
      patch.document_urls = parseStringArray(body.document_urls)
    }
    if (body.contact_email != null) {
      patch.contact_email = body.contact_email?.trim() || null
    }
    if (body.contact_name != null) {
      patch.contact_name = body.contact_name?.trim() || null
    }
    if (body.is_published != null) patch.is_published = Boolean(body.is_published)
    if (body.disclaimer_acknowledged != null) {
      patch.disclaimer_acknowledged = Boolean(body.disclaimer_acknowledged)
    }

    if (body.verification_status != null) {
      const next = body.verification_status as GschProjectVerificationStatus
      if (next === 'verified' && !isAdmin) {
        return forbiddenResponse('Only platform admins can verify projects.')
      }
      if (
        !['unverified', 'pending_review', 'verified', 'rejected'].includes(next)
      ) {
        return errorResponse('Invalid verification_status', 400)
      }
      // Org reps may request review; only admin sets verified/rejected via admin routes ideally
      if (!isAdmin && next !== 'pending_review' && next !== 'unverified') {
        return forbiddenResponse('Not authorized to set this verification status.')
      }
      patch.verification_status = next
    }

    if (Object.keys(patch).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data, error } = await supabase
      .from('gsch_projects')
      .update(patch)
      .eq('id', id)
      .select(GSCH_PROJECT_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'project_updated',
      entity_type: 'gsch_project',
      entity_id: id,
      metadata: patch,
    })

    const { data: save } = await supabase
      .from('gsch_project_saves')
      .select('id')
      .eq('project_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    return jsonResponse({ ...data, is_saved: Boolean(save) })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update project', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const { deleteGschOrgEntity } = await import('@/lib/gsch/delete-entity')
    return deleteGschOrgEntity({
      supabase,
      userId: user.id,
      id,
      table: 'gsch_projects',
      entityType: 'gsch_project',
      action: 'project_deleted',
      notFoundMessage: 'Project not found',
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to delete project', 500)
  }
}
