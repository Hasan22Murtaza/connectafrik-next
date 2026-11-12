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
import { DEFAULT_APPLICATION_QUESTIONS } from '@/shared/types/youthLeadership'

const PROGRAM_SELECT = `
  *,
  organization:youth_organizations!organization_id(
    id, name, logo_url, verification_status, country, region
  ),
  category:youth_program_categories!category_id(id, slug, name)
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
    const search = searchParams.get('search')?.trim() || ''
    const category = searchParams.get('category') || ''
    const skill = searchParams.get('skill') || ''
    const format = searchParams.get('format') || ''
    const country = searchParams.get('country') || ''
    const region = searchParams.get('region') || ''
    const age = searchParams.get('age')
    const deadlineBefore = searchParams.get('deadline_before')
    const sort = searchParams.get('sort') || 'newest'
    const mine = searchParams.get('mine') === '1'
    const orgId = searchParams.get('organization_id')
    const status = searchParams.get('status')
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1),
      50
    )
    const from = page * limit
    const to = from + limit - 1

    let query = supabase
      .from('youth_programs')
      .select(PROGRAM_SELECT)
      .range(from, to)

    if (mine) {
      // Coordinator view of org programs is separate; "mine" = enrolled
      const { data: enrollments } = await supabase
        .from('youth_program_enrollments')
        .select('program_id')
        .eq('user_id', user.id)
        .in('status', ['active', 'completed'])
      const ids = (enrollments || []).map((e) => e.program_id)
      if (ids.length === 0) {
        return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
      }
      query = query.in('id', ids)
    } else if (orgId) {
      const authz = await requireOrgRole(supabase, orgId, user.id, 'viewer')
      if (!authz.ok) return forbiddenResponse(authz.message)
      query = query.eq('organization_id', orgId)
      if (status) query = query.eq('status', status)
    } else {
      query = query.eq('status', 'published')
    }

    if (category) query = query.eq('category_slug', category)
    if (format) query = query.eq('format', format)
    if (country) query = query.eq('country', country)
    if (region) query = query.ilike('location_region', `%${region}%`)
    if (deadlineBefore) query = query.lte('application_deadline', deadlineBefore)
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,eligibility.ilike.%${search}%`
      )
    }
    if (skill) {
      query = query.contains('required_skills', [skill])
    }
    if (age) {
      const ageNum = parseInt(age, 10)
      if (!Number.isNaN(ageNum)) {
        query = query
          .or(`minimum_age.is.null,minimum_age.lte.${ageNum}`)
          .or(`maximum_age.is.null,maximum_age.gte.${ageNum}`)
      }
    }

    if (sort === 'deadline') {
      query = query
        .order('application_deadline', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
    } else if (sort === 'popularity') {
      query = query
        .order('popularity_score', { ascending: false })
        .order('created_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    const { data, error } = await query
    if (error) return errorResponse(error.message, 400)

    const programs = data || []
    const programIds = programs.map((p: { id: string }) => p.id)
    let appsByProgram = new Map<string, any>()
    let enrollByProgram = new Map<string, any>()
    if (programIds.length > 0) {
      const [{ data: apps }, { data: enrollments }] = await Promise.all([
        supabase
          .from('youth_program_applications')
          .select('*')
          .eq('user_id', user.id)
          .in('program_id', programIds),
        supabase
          .from('youth_program_enrollments')
          .select('*')
          .eq('user_id', user.id)
          .in('program_id', programIds),
      ])
      for (const a of apps || []) appsByProgram.set(a.program_id, a)
      for (const e of enrollments || []) enrollByProgram.set(e.program_id, e)
    }

    const enriched = programs.map((p: any) => ({
      ...p,
      my_application: appsByProgram.get(p.id) || null,
      my_enrollment: enrollByProgram.get(p.id) || null,
    }))

    return jsonResponse({
      data: enriched,
      page,
      pageSize: limit,
      hasMore: programs.length === limit,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load programs', 500)
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
    const organizationId = body.organization_id as string
    if (!organizationId || !body.title?.trim()) {
      return errorResponse('organization_id and title are required', 400)
    }

    const authz = await requireOrgRole(supabase, organizationId, user.id, 'coordinator')
    if (!authz.ok) return forbiddenResponse(authz.message)

    const { data: org } = await supabase
      .from('youth_organizations')
      .select('id, verification_status')
      .eq('id', organizationId)
      .single()

    if (!org) return errorResponse('Organization not found', 404)
    if (org.verification_status === 'suspended') {
      return forbiddenResponse('Organization is suspended.')
    }

    const payload = {
      organization_id: organizationId,
      title: String(body.title).trim(),
      description: body.description ?? null,
      objectives: body.objectives ?? null,
      category_id: body.category_id ?? null,
      category_slug: body.category_slug ?? null,
      eligibility: body.eligibility ?? null,
      minimum_age: body.minimum_age ?? null,
      maximum_age: body.maximum_age ?? null,
      required_skills: Array.isArray(body.required_skills) ? body.required_skills : null,
      format: body.format || 'hybrid',
      location_region: body.location_region ?? null,
      country: body.country ?? null,
      schedule: body.schedule ?? null,
      requirements: body.requirements ?? null,
      safety_information: body.safety_information ?? null,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
      application_deadline: body.application_deadline ?? null,
      capacity: body.capacity ?? null,
      requires_guardian_approval: Boolean(body.requires_guardian_approval),
      application_questions: Array.isArray(body.application_questions)
        ? body.application_questions
        : DEFAULT_APPLICATION_QUESTIONS,
      status: body.status === 'published' ? 'published' : 'draft',
      created_by: user.id,
      published_at: body.status === 'published' ? new Date().toISOString() : null,
    }

    const { data, error } = await supabase
      .from('youth_programs')
      .insert(payload)
      .select(PROGRAM_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)
    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create program', 500)
  }
}
