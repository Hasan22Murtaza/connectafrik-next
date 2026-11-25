import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { GSCH_INNOVATION_CHALLENGE_SELECT, parseGschTags } from '@/lib/gsch/selects'
import type {
  GschInnovationChallengeStatus,
  GschInnovationFocusArea,
} from '@/shared/types/gsch'

const FOCUS_AREAS: GschInnovationFocusArea[] = [
  'ai_transportation',
  'smart_traffic',
  'smart_parking',
  'digital_twins',
  'public_safety',
  'water_management',
  'urban_infrastructure',
  'cybersecurity',
  'other',
]

const STATUSES: GschInnovationChallengeStatus[] = [
  'draft',
  'open',
  'closed',
  'awarded',
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const { data, error } = await supabase
      .from('gsch_innovation_challenges')
      .select(GSCH_INNOVATION_CHALLENGE_SELECT)
      .eq('id', id)
      .maybeSingle()
    if (error) return errorResponse(error.message, 400)
    if (!data) return errorResponse('Innovation challenge not found', 404)
    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load innovation challenge', 500)
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
      .from('gsch_innovation_challenges')
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!existing) return errorResponse('Innovation challenge not found', 404)

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
    if (body.focus_area != null) {
      if (!FOCUS_AREAS.includes(body.focus_area)) {
        return errorResponse('Invalid focus_area', 400)
      }
      patch.focus_area = body.focus_area
    }
    if (body.country != null) patch.country = body.country?.trim() || null
    if (body.continent != null) patch.continent = body.continent?.trim() || null
    if (body.location_label != null) {
      patch.location_label = body.location_label?.trim() || null
    }
    if (body.prize_or_benefit != null) {
      patch.prize_or_benefit = body.prize_or_benefit?.trim() || null
    }
    if (body.city_id !== undefined) patch.city_id = body.city_id || null
    if (body.submission_deadline !== undefined) {
      patch.submission_deadline = body.submission_deadline || null
    }
    if (body.external_url != null) patch.external_url = body.external_url?.trim() || null
    if (body.contact_email != null) {
      patch.contact_email = body.contact_email?.trim() || null
    }
    if (body.tags != null) patch.tags = parseGschTags(body.tags)
    if (body.status != null) {
      if (!STATUSES.includes(body.status)) {
        return errorResponse('Invalid status', 400)
      }
      patch.status = body.status
    }
    if (body.is_published != null) patch.is_published = Boolean(body.is_published)

    if (Object.keys(patch).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    const { data, error } = await supabase
      .from('gsch_innovation_challenges')
      .update(patch)
      .eq('id', id)
      .select(GSCH_INNOVATION_CHALLENGE_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'innovation_challenge_updated',
      entity_type: 'gsch_innovation_challenge',
      entity_id: id,
      metadata: patch,
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update innovation challenge', 500)
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
      table: 'gsch_innovation_challenges',
      entityType: 'gsch_innovation_challenge',
      action: 'innovation_challenge_deleted',
      notFoundMessage: 'Innovation challenge not found',
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to delete innovation challenge', 500)
  }
}
