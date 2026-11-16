import type { SupabaseClient } from '@supabase/supabase-js'
import { ageFromBirthday } from '@/lib/family/age'
import { checkParentalRestriction } from '@/lib/family/controls'
import type { YouthOrgMemberRole } from '@/shared/types/youthLeadership'

export type YouthAccessDecision = {
  allowed: boolean
  code?: 'PARENTAL_RESTRICTED' | 'AGE_INELIGIBLE' | 'FORBIDDEN'
  message?: string
  age?: number | null
}

export async function isPlatformYouthAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('platform_role')
    .eq('id', userId)
    .maybeSingle()
  const role = data?.platform_role
  return role === 'admin' || role === 'super_admin'
}

export async function getOrgMembership(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
) {
  const { data } = await supabase
    .from('youth_organization_members')
    .select('id, organization_id, user_id, role, status')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  return data
}

export function orgRoleRank(role: YouthOrgMemberRole | string | null | undefined): number {
  if (role === 'admin') return 3
  if (role === 'coordinator') return 2
  if (role === 'viewer') return 1
  return 0
}

export async function requireOrgRole(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  minRole: YouthOrgMemberRole
): Promise<{ ok: true; membership: NonNullable<Awaited<ReturnType<typeof getOrgMembership>>> } | { ok: false; message: string }> {
  if (await isPlatformYouthAdmin(supabase, userId)) {
    return {
      ok: true,
      membership: {
        id: 'platform-admin',
        organization_id: organizationId,
        user_id: userId,
        role: 'admin',
        status: 'active',
      } as any,
    }
  }
  const membership = await getOrgMembership(supabase, organizationId, userId)
  if (!membership || orgRoleRank(membership.role) < orgRoleRank(minRole)) {
    return { ok: false, message: 'Not authorized for this organization.' }
  }
  return { ok: true, membership }
}

export async function getUserAge(
  supabase: SupabaseClient,
  userId: string
): Promise<number | null> {
  const { data } = await supabase
    .from('profiles')
    .select('birthday')
    .eq('id', userId)
    .maybeSingle()
  return ageFromBirthday(data?.birthday ?? null)
}

/** Gate Youth Leadership feature access for managed minors. */
export async function checkYouthLeadershipAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<YouthAccessDecision> {
  const [parental, age] = await Promise.all([
    checkParentalRestriction(supabase, userId, 'youth_leadership'),
    getUserAge(supabase, userId),
  ])
  if (!parental.allowed) {
    return {
      allowed: false,
      code: 'PARENTAL_RESTRICTED',
      message: parental.message || 'Youth Leadership is restricted by your parent.',
      age,
    }
  }
  return { allowed: true, age }
}

export function isAgeEligible(
  age: number | null | undefined,
  minimumAge: number | null | undefined,
  maximumAge: number | null | undefined
): boolean {
  if (age == null) {
    // Unknown age: allow discovery, block apply at API with clearer message when required
    return true
  }
  if (minimumAge != null && age < minimumAge) return false
  if (maximumAge != null && age > maximumAge) return false
  return true
}

export async function writeYouthAuditLog(
  supabase: SupabaseClient,
  input: {
    actor_id: string
    action: string
    entity_type: string
    entity_id?: string | null
    metadata?: Record<string, unknown>
  }
) {
  await supabase.from('youth_audit_logs').insert({
    actor_id: input.actor_id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    metadata: input.metadata ?? {},
  })
}
