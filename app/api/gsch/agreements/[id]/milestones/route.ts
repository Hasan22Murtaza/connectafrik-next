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
import { GSCH_AGREEMENT_MILESTONE_SELECT } from '@/lib/gsch/selects'

async function authorizeAgreementRep(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>['supabase'],
  userId: string,
  agreementId: string
) {
  const { data: agreement } = await supabase
    .from('gsch_agreements')
    .select('id, organization_a_id, organization_b_id')
    .eq('id', agreementId)
    .maybeSingle()
  if (!agreement) return { ok: false as const, message: 'Agreement not found', agreement: null }

  if (await isPlatformGschAdmin(supabase, userId)) {
    return { ok: true as const, agreement }
  }
  const authA = await requireOrgRole(
    supabase,
    agreement.organization_a_id,
    userId,
    'representative'
  )
  const authB = await requireOrgRole(
    supabase,
    agreement.organization_b_id,
    userId,
    'representative'
  )
  if (!authA.ok && !authB.ok) {
    return { ok: false as const, message: 'Not authorized', agreement }
  }
  return { ok: true as const, agreement }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const { data, error } = await supabase
      .from('gsch_agreement_milestones')
      .select(GSCH_AGREEMENT_MILESTONE_SELECT)
      .eq('agreement_id', id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ data: data || [] })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load milestones', 500)
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

    const authz = await authorizeAgreementRep(supabase, user.id, id)
    if (!authz.ok) {
      if (!authz.agreement) return errorResponse(authz.message, 404)
      return forbiddenResponse(authz.message)
    }
    if (!body.title?.trim()) return errorResponse('title is required', 400)

    const { data, error } = await supabase
      .from('gsch_agreement_milestones')
      .insert({
        agreement_id: id,
        title: String(body.title).trim(),
        description: body.description?.trim() || null,
        due_at: body.due_at || null,
        status: body.status || 'pending',
        sort_order: Number.isFinite(Number(body.sort_order))
          ? Number(body.sort_order)
          : 0,
      })
      .select(GSCH_AGREEMENT_MILESTONE_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'agreement_milestone_created',
      entity_type: 'gsch_agreement_milestone',
      entity_id: data.id,
      metadata: { agreement_id: id, title: data.title },
    })

    return jsonResponse(data, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create milestone', 500)
  }
}
