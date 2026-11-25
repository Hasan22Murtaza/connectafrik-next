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
import { GSCH_TRADE_ENQUIRY_SELECT } from '@/lib/gsch/selects'
import type { GschTradeEnquiryType } from '@/shared/types/gsch'

const ENQUIRY_TYPES: GschTradeEnquiryType[] = [
  'buyer',
  'supplier',
  'distributor',
  'export',
  'import',
  'partnership',
  'general',
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
    const direction = searchParams.get('direction')?.trim() || ''

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
      .from('gsch_trade_enquiries')
      .select(GSCH_TRADE_ENQUIRY_SELECT)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    if (direction === 'sent') {
      query = query.in('from_organization_id', orgIds)
    } else if (direction === 'received') {
      query = query.in('to_organization_id', orgIds)
    } else {
      query = query.or(
        `from_organization_id.in.(${orgIds.join(',')}),to_organization_id.in.(${orgIds.join(',')})`
      )
    }

    const from = page * limit
    const to = from + limit - 1
    const { data, error } = await query.range(from, to)
    if (error) return errorResponse(error.message, 400)

    const orgSet = new Set(orgIds)
    const enriched = (data || []).map((row: any) => ({
      ...row,
      direction: orgSet.has(row.from_organization_id) ? 'sent' : 'received',
    }))

    return jsonResponse({
      data: enriched,
      page,
      pageSize: limit,
      hasMore: (data || []).length === limit,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to load trade enquiries', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    if (!body.from_organization_id) {
      return errorResponse('from_organization_id is required', 400)
    }
    if (!body.to_organization_id) {
      return errorResponse('to_organization_id is required', 400)
    }
    if (body.from_organization_id === body.to_organization_id) {
      return errorResponse('Cannot send an enquiry to your own organization', 400)
    }
    if (!body.subject?.trim()) return errorResponse('subject is required', 400)
    if (!body.message?.trim()) return errorResponse('message is required', 400)
    if (!ENQUIRY_TYPES.includes(body.enquiry_type)) {
      return errorResponse('Invalid enquiry_type', 400)
    }

    const authz = await requireOrgRole(
      supabase,
      body.from_organization_id,
      user.id,
      'member'
    )
    if (!authz.ok) return forbiddenResponse(authz.message)

    let toBusinessProfileId = body.to_business_profile_id || null
    if (toBusinessProfileId) {
      const { data: profile } = await supabase
        .from('gsch_business_profiles')
        .select('id, organization_id, display_name')
        .eq('id', toBusinessProfileId)
        .maybeSingle()
      if (!profile) return errorResponse('Business profile not found', 404)
      if (profile.organization_id !== body.to_organization_id) {
        return errorResponse('Profile does not belong to target organization', 400)
      }
    }

    const { data, error } = await supabase
      .from('gsch_trade_enquiries')
      .insert({
        from_organization_id: body.from_organization_id,
        to_organization_id: body.to_organization_id,
        to_business_profile_id: toBusinessProfileId,
        enquiry_type: body.enquiry_type,
        subject: String(body.subject).trim(),
        message: String(body.message).trim(),
        status: 'open',
        created_by: user.id,
      })
      .select(GSCH_TRADE_ENQUIRY_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'trade_enquiry_created',
      entity_type: 'gsch_trade_enquiry',
      entity_id: data.id,
      metadata: {
        enquiry_type: data.enquiry_type,
        to_organization_id: data.to_organization_id,
      },
    })

    await notifyGschOrgOwners(supabase, body.to_organization_id, {
      type: 'gsch_trade_enquiry',
      title: 'New trade enquiry',
      message: data.subject,
      data: {
        enquiry_id: data.id,
        type: 'gsch_trade_enquiry',
      },
      excludeUserId: user.id,
    })

    return jsonResponse({ ...data, direction: 'sent' }, 201)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to create trade enquiry', 500)
  }
}
