import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { GSCH_BUSINESS_PROFILE_SELECT } from '@/lib/gsch/selects'

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

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)

    const q = searchParams.get('q')?.trim() || ''
    const country = searchParams.get('country')?.trim() || ''
    const sector = searchParams.get('sector')?.trim() || ''
    const seeking = searchParams.get('seeking')?.trim() || ''
    const offering = searchParams.get('offering')?.trim() || ''
    const mine = searchParams.get('mine') === '1'
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1),
      50
    )
    const from = page * limit
    const to = from + limit - 1

    let query = supabase
      .from('gsch_business_profiles')
      .select(GSCH_BUSINESS_PROFILE_SELECT)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (mine) {
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

    if (country) query = query.ilike('country', `%${country}%`)
    if (sector) query = query.contains('industry_sectors', [sector])
    if (seeking) query = query.contains('seeking', [seeking])
    if (offering) query = query.contains('offering', [offering])
    if (q) {
      query = query.or(
        `display_name.ilike.%${q}%,tagline.ilike.%${q}%,description.ilike.%${q}%,city.ilike.%${q}%`
      )
    }

    const { data, error } = await query
    if (error) return errorResponse(error.message, 400)

    return jsonResponse({
      data: data || [],
      page,
      pageSize: limit,
      hasMore: (data || []).length === limit,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load business profiles', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    if (!body.organization_id) return errorResponse('organization_id is required', 400)
    if (!body.display_name?.trim()) return errorResponse('display_name is required', 400)

    const authz = await requireOrgRole(
      supabase,
      body.organization_id,
      user.id,
      'representative'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const { data: existing } = await supabase
      .from('gsch_business_profiles')
      .select('id')
      .eq('organization_id', body.organization_id)
      .maybeSingle()

    if (existing) {
      // Upsert-ish: update existing profile for org
      const patch: Record<string, unknown> = {
        display_name: String(body.display_name).trim(),
      }
      if (body.tagline !== undefined) patch.tagline = body.tagline?.trim() || null
      if (body.description !== undefined) {
        patch.description = body.description?.trim() || null
      }
      if (body.logo_url !== undefined) patch.logo_url = body.logo_url?.trim() || null
      if (body.website !== undefined) patch.website = body.website?.trim() || null
      if (body.country !== undefined) patch.country = body.country?.trim() || null
      if (body.city !== undefined) patch.city = body.city?.trim() || null
      if (body.industry_sectors != null) {
        patch.industry_sectors = parseStringArray(body.industry_sectors)
      }
      if (body.seeking != null) patch.seeking = parseStringArray(body.seeking)
      if (body.offering != null) patch.offering = parseStringArray(body.offering)
      if (body.export_markets != null) {
        patch.export_markets = parseStringArray(body.export_markets)
      }
      if (body.import_needs != null) {
        patch.import_needs = parseStringArray(body.import_needs)
      }
      if (body.languages != null) patch.languages = parseStringArray(body.languages)
      if (body.employee_range !== undefined) {
        patch.employee_range = body.employee_range?.trim() || null
      }
      if (body.year_established !== undefined) {
        patch.year_established = body.year_established
          ? Number(body.year_established)
          : null
      }
      if (body.is_published != null) patch.is_published = Boolean(body.is_published)

      const { data, error } = await supabase
        .from('gsch_business_profiles')
        .update(patch)
        .eq('id', existing.id)
        .select(GSCH_BUSINESS_PROFILE_SELECT)
        .single()
      if (error) return errorResponse(error.message, 400)

      await writeGschAuditLog(supabase, {
        actor_id: user.id,
        action: 'business_profile_updated',
        entity_type: 'gsch_business_profile',
        entity_id: data.id,
        metadata: { via: 'post_upsert' },
      })

      return jsonResponse(data)
    }

    const { data, error } = await supabase
      .from('gsch_business_profiles')
      .insert({
        organization_id: body.organization_id,
        display_name: String(body.display_name).trim(),
        tagline: body.tagline?.trim() || null,
        description: body.description?.trim() || null,
        logo_url: body.logo_url?.trim() || null,
        website: body.website?.trim() || null,
        country: body.country?.trim() || null,
        city: body.city?.trim() || null,
        industry_sectors: parseStringArray(body.industry_sectors),
        seeking: parseStringArray(body.seeking),
        offering: parseStringArray(body.offering),
        export_markets: parseStringArray(body.export_markets),
        import_needs: parseStringArray(body.import_needs),
        languages: parseStringArray(body.languages),
        employee_range: body.employee_range?.trim() || null,
        year_established: body.year_established
          ? Number(body.year_established)
          : null,
        is_published: Boolean(body.is_published),
        created_by: user.id,
      })
      .select(GSCH_BUSINESS_PROFILE_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'business_profile_created',
      entity_type: 'gsch_business_profile',
      entity_id: data.id,
      metadata: { display_name: data.display_name },
    })

    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create business profile', 500)
  }
}
