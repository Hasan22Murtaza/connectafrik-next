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
import { GSCH_TOURISM_REQUEST_SELECT } from '@/lib/gsch/selects'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { id } = await params

    const { data: initiative, error: loadError } = await supabase
      .from('gsch_tourism_initiatives')
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!initiative) return errorResponse('Tourism initiative not found', 404)

    const authz = await requireOrgRole(
      supabase,
      initiative.organization_id,
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
      .from('gsch_tourism_partnership_requests')
      .select(GSCH_TOURISM_REQUEST_SELECT)
      .eq('initiative_id', id)
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
    return errorResponse(error?.message || 'Failed to load partnership requests', 500)
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

    if (!body.from_organization_id) {
      return errorResponse('from_organization_id is required', 400)
    }
    if (!body.message?.trim()) return errorResponse('message is required', 400)

    const { data: initiative, error: loadError } = await supabase
      .from('gsch_tourism_initiatives')
      .select('id, organization_id, title, is_published')
      .eq('id', id)
      .maybeSingle()
    if (loadError) return errorResponse(loadError.message, 400)
    if (!initiative) return errorResponse('Tourism initiative not found', 404)
    if (!initiative.is_published) {
      return errorResponse('Initiative is not published', 400)
    }

    const authz = await requireOrgRole(
      supabase,
      body.from_organization_id,
      user.id,
      'member'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    const { data, error } = await supabase
      .from('gsch_tourism_partnership_requests')
      .insert({
        initiative_id: id,
        from_organization_id: body.from_organization_id,
        message: String(body.message).trim(),
        status: 'submitted',
        created_by: user.id,
      })
      .select(GSCH_TOURISM_REQUEST_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'tourism_partnership_request_created',
      entity_type: 'gsch_tourism_partnership_request',
      entity_id: data.id,
      metadata: { initiative_id: id },
    })

    await notifyGschOrgOwners(supabase, initiative.organization_id, {
      type: 'gsch_tourism_partnership',
      title: 'Tourism partnership request',
      message: `A partnership request was submitted for “${initiative.title}”.`,
      data: {
        initiative_id: id,
        request_id: data.id,
        type: 'gsch_tourism_partnership',
      },
      excludeUserId: user.id,
    })

    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to submit partnership request', 500)
  }
}
