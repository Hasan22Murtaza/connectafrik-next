import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import type { GschOpportunityCategory } from '@/shared/types/gsch'

const CATEGORIES: GschOpportunityCategory[] = [
  'investment',
  'grant',
  'conference',
  'trade_mission',
  'development_funding',
  'innovation_challenge',
  'sister_city',
  'education_program',
  'other',
]

const OPP_SELECT = `
  id, organization_id, city_id, title, summary, description, category,
  country, continent, location_label, starts_at, ends_at,
  application_deadline, external_url, contact_email, tags,
  is_published, created_by, created_at, updated_at,
  organization:gsch_organizations!organization_id(
    id, name, country, logo_url, verification_status
  ),
  city:gsch_cities!city_id(id, name, country, logo_url)
`

function parseTags(value: unknown): string[] {
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const { data, error } = await supabase
      .from('gsch_opportunities')
      .select(OPP_SELECT)
      .eq('id', id)
      .maybeSingle()
    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('Opportunity not found', 404)
    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load opportunity', 500)
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
      .from('gsch_opportunities')
      .select('id, organization_id, is_published')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Opportunity not found', 404)

    const authz = await requireOrgRole(
      supabase,
      existing.organization_id,
      user.id,
      'representative'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const patch: Record<string, unknown> = {}
    if (body.title != null) patch.title = String(body.title).trim()
    if (body.summary != null) patch.summary = body.summary?.trim() || null
    if (body.description != null) patch.description = body.description?.trim() || null
    if (body.category != null) {
      if (!CATEGORIES.includes(body.category)) {
        return errorResponse('Invalid category', 400)
      }
      patch.category = body.category
    }
    if (body.country != null) patch.country = body.country?.trim() || null
    if (body.continent != null) patch.continent = body.continent?.trim() || null
    if (body.location_label != null) {
      patch.location_label = body.location_label?.trim() || null
    }
    if (body.city_id !== undefined) patch.city_id = body.city_id || null
    if (body.starts_at !== undefined) patch.starts_at = body.starts_at || null
    if (body.ends_at !== undefined) patch.ends_at = body.ends_at || null
    if (body.application_deadline !== undefined) {
      patch.application_deadline = body.application_deadline || null
    }
    if (body.external_url != null) patch.external_url = body.external_url?.trim() || null
    if (body.contact_email != null) {
      patch.contact_email = body.contact_email?.trim() || null
    }
    if (body.tags != null) patch.tags = parseTags(body.tags)
    if (body.is_published != null) patch.is_published = Boolean(body.is_published)

    if (Object.keys(patch).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data, error } = await supabase
      .from('gsch_opportunities')
      .update(patch)
      .eq('id', id)
      .select(OPP_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'opportunity_updated',
      entity_type: 'gsch_opportunity',
      entity_id: id,
      metadata: patch,
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update opportunity', 500)
  }
}
