import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { getOrgMembership, writeGschAuditLog } from '@/lib/gsch/auth'
import { GSCH_AGREEMENT_APPROVAL_SELECT } from '@/lib/gsch/selects'
import { notifyGschOrgOwners } from '@/lib/gsch/notify'
import {
  GSCH_AGREEMENT_DISCLAIMER,
  type GschAgreementApprovalAction,
} from '@/shared/types/gsch'

const ACTIONS: GschAgreementApprovalAction[] = [
  'submitted',
  'approved',
  'rejected',
  'comment',
  'signed_intent',
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase } = await getAuthenticatedUser(request)
    const { id } = await params
    const { data, error } = await supabase
      .from('gsch_agreement_approvals')
      .select(GSCH_AGREEMENT_APPROVAL_SELECT)
      .eq('agreement_id', id)
      .order('created_at', { ascending: false })
    if (error) return errorResponse(error.message, 400)
    return jsonResponse({ data: data || [] })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load approvals', 500)
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

    if (!ACTIONS.includes(body.action)) {
      return errorResponse('Invalid approval action', 400)
    }
    if (!body.organization_id) {
      return errorResponse('organization_id is required', 400)
    }

    const membership = await getOrgMembership(
      supabase,
      body.organization_id,
      user.id
    )
    if (!membership) {
      return forbiddenResponse('You must be a member of the acting organization')
    }

    const { data: agreement } = await supabase
      .from('gsch_agreements')
      .select('id, title, organization_a_id, organization_b_id, status')
      .eq('id', id)
      .maybeSingle()
    if (!agreement) return errorResponse('Agreement not found', 404)

    if (
      body.organization_id !== agreement.organization_a_id &&
      body.organization_id !== agreement.organization_b_id
    ) {
      return forbiddenResponse('Organization is not a party to this agreement')
    }

    if (body.action === 'signed_intent') {
      if (!body.disclaimer_acknowledged) {
        return errorResponse(
          `Disclaimer acknowledgement required. ${GSCH_AGREEMENT_DISCLAIMER}`,
          400
        )
      }
    }

    const notes =
      body.action === 'signed_intent'
        ? [
            body.notes?.trim() || null,
            'Intent recorded only — not a legally binding electronic signature.',
          ]
            .filter(Boolean)
            .join(' ')
        : body.notes?.trim() || null

    const { data, error } = await supabase
      .from('gsch_agreement_approvals')
      .insert({
        agreement_id: id,
        organization_id: body.organization_id,
        approver_user_id: user.id,
        action: body.action,
        notes,
      })
      .select(GSCH_AGREEMENT_APPROVAL_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    // Soft status nudges — never claim legal execution
    let nextStatus: string | null = null
    if (body.action === 'submitted' && agreement.status === 'draft') {
      nextStatus = 'submitted'
    } else if (body.action === 'approved' && ['submitted', 'discussion'].includes(agreement.status)) {
      nextStatus = 'approved'
    } else if (body.action === 'rejected' && !['completed', 'cancelled'].includes(agreement.status)) {
      nextStatus = 'discussion'
    } else if (
      body.action === 'signed_intent' &&
      ['approved', 'signed'].includes(agreement.status)
    ) {
      nextStatus = 'signed'
    }

    if (nextStatus) {
      await supabase
        .from('gsch_agreements')
        .update({ status: nextStatus })
        .eq('id', id)
    }

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'agreement_approval',
      entity_type: 'gsch_agreement',
      entity_id: id,
      metadata: {
        approval_action: body.action,
        next_status: nextStatus,
        legal_esign: false,
      },
    })

    const otherOrg =
      body.organization_id === agreement.organization_a_id
        ? agreement.organization_b_id
        : agreement.organization_a_id

    await notifyGschOrgOwners(supabase, otherOrg, {
      type: 'gsch_agreement_update',
      title: 'Agreement workflow update',
      message: `"${agreement.title}" received action: ${body.action.replace(/_/g, ' ')}.`,
      data: {
        agreement_id: id,
        action: body.action,
        legal_esign: false,
      },
      excludeUserId: user.id,
    })

    return jsonResponse(
      {
        ...data,
        disclaimer: GSCH_AGREEMENT_DISCLAIMER,
        legal_esign: false,
      },
      201
    )
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to record approval', 500)
  }
}
