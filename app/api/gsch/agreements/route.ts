import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { requireOrgRole, writeGschAuditLog } from '@/lib/gsch/auth'
import { GSCH_AGREEMENT_SELECT, parseGschTags } from '@/lib/gsch/selects'
import { notifyGschOrgOwners } from '@/lib/gsch/notify'
import type { GschAgreementTemplateType } from '@/shared/types/gsch'

const TEMPLATE_TYPES: GschAgreementTemplateType[] = [
  'sister_city',
  'economic',
  'tourism',
  'education',
  'climate',
  'custom',
]

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10) || 0, 0)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1),
      50
    )
    const status = searchParams.get('status')?.trim() || ''
    const from = page * limit
    const to = from + limit - 1

    const { data: memberships } = await supabase
      .from('gsch_memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
    const orgIds = (memberships || []).map((m) => m.organization_id)
    if (orgIds.length === 0) {
      return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
    }

    let query = supabase
      .from('gsch_agreements')
      .select(GSCH_AGREEMENT_SELECT)
      .or(
        `organization_a_id.in.(${orgIds.join(',')}),organization_b_id.in.(${orgIds.join(',')})`
      )
      .order('updated_at', { ascending: false })
      .range(from, to)

    if (status) query = query.eq('status', status)

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
    return errorResponse(error?.message || 'Failed to load agreements', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    if (!body.organization_a_id) {
      return errorResponse('organization_a_id is required', 400)
    }
    if (!body.organization_b_id) {
      return errorResponse('organization_b_id is required', 400)
    }
    if (body.organization_a_id === body.organization_b_id) {
      return errorResponse('Organizations must be different', 400)
    }
    if (!body.title?.trim()) return errorResponse('title is required', 400)
    if (!TEMPLATE_TYPES.includes(body.template_type)) {
      return errorResponse('Invalid template_type', 400)
    }

    const authz = await requireOrgRole(
      supabase,
      body.organization_a_id,
      user.id,
      'representative'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const { data, error } = await supabase
      .from('gsch_agreements')
      .insert({
        partnership_id: body.partnership_id || null,
        template_type: body.template_type,
        title: String(body.title).trim(),
        organization_a_id: body.organization_a_id,
        organization_b_id: body.organization_b_id,
        city_a_id: body.city_a_id || null,
        city_b_id: body.city_b_id || null,
        objectives: body.objectives?.trim() || null,
        duration_label: body.duration_label?.trim() || null,
        responsibilities_a: body.responsibilities_a?.trim() || null,
        responsibilities_b: body.responsibilities_b?.trim() || null,
        document_urls: parseGschTags(body.document_urls),
        status: 'draft',
        created_by: user.id,
      })
      .select(GSCH_AGREEMENT_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'agreement_created',
      entity_type: 'gsch_agreement',
      entity_id: data.id,
      metadata: { title: data.title, status: data.status },
    })

    await notifyGschOrgOwners(supabase, body.organization_b_id, {
      type: 'gsch_agreement_update',
      title: 'New partnership agreement draft',
      message: `"${data.title}" was drafted with your organization.`,
      data: { agreement_id: data.id },
      excludeUserId: user.id,
    })

    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create agreement', 500)
  }
}
