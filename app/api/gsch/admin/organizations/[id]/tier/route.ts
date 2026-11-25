import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import {
  errorResponse,
  forbiddenResponse,
  jsonResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { isPlatformGschAdmin, writeGschAuditLog } from '@/lib/gsch/auth'
import type { GschSubscriptionTier } from '@/shared/types/gsch'

const TIERS: GschSubscriptionTier[] = ['free', 'standard', 'enterprise']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    if (!(await isPlatformGschAdmin(supabase, user.id))) {
      return forbiddenResponse('Platform admin required')
    }

    const { id } = await params
    const body = await request.json()

    if (!TIERS.includes(body.subscription_tier)) {
      return errorResponse('Invalid subscription_tier', 400)
    }

    const { data: existing } = await supabase
      .from('gsch_organizations')
      .select('id, name, subscription_tier')
      .eq('id', id)
      .maybeSingle()
    if (!existing) return errorResponse('Organization not found', 404)

    const { data, error } = await supabase
      .from('gsch_organizations')
      .update({
        subscription_tier: body.subscription_tier,
        subscription_notes: body.subscription_notes?.trim() || null,
        subscription_updated_at: new Date().toISOString(),
        subscription_updated_by: user.id,
      })
      .eq('id', id)
      .select(
        `
        id, name, org_type, country, city, logo_url,
        verification_status, verification_badge,
        subscription_tier, subscription_notes,
        subscription_updated_at, subscription_updated_by,
        created_at, updated_at
      `
      )
      .single()

    if (error) return errorResponse(error.message, 400)

    await writeGschAuditLog(supabase, {
      actor_id: user.id,
      action: 'organization_tier_updated',
      entity_type: 'gsch_organization',
      entity_id: id,
      metadata: {
        from: existing.subscription_tier,
        to: body.subscription_tier,
        payment: false,
      },
    })

    return jsonResponse(data)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return unauthorizedResponse()
    return errorResponse(error?.message || 'Failed to update tier', 500)
  }
}
