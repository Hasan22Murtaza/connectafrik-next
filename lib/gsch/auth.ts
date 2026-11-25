import type { SupabaseClient } from '@supabase/supabase-js'
import type { GschOrgMemberRole } from '@/shared/types/gsch'

export async function isPlatformGschAdmin(
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
    .from('gsch_memberships')
    .select('id, organization_id, user_id, role, status')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  return data
}

export function orgRoleRank(role: GschOrgMemberRole | string | null | undefined): number {
  if (role === 'owner') return 4
  if (role === 'admin') return 3
  if (role === 'representative') return 2
  if (role === 'member') return 1
  return 0
}

export async function requireOrgRole(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  minRole: GschOrgMemberRole
): Promise<
  | {
      ok: true
      membership: NonNullable<Awaited<ReturnType<typeof getOrgMembership>>>
    }
  | { ok: false; message: string }
> {
  if (await isPlatformGschAdmin(supabase, userId)) {
    return {
      ok: true,
      membership: {
        id: 'platform-admin',
        organization_id: organizationId,
        user_id: userId,
        role: 'owner',
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

export async function canManageCity(
  supabase: SupabaseClient,
  cityId: string,
  userId: string
): Promise<boolean> {
  if (await isPlatformGschAdmin(supabase, userId)) return true

  const { data: city } = await supabase
    .from('gsch_cities')
    .select('id, created_by, organization_id')
    .eq('id', cityId)
    .maybeSingle()

  if (!city) return false
  if (city.created_by === userId) return true

  if (city.organization_id) {
    const authz = await requireOrgRole(
      supabase,
      city.organization_id,
      userId,
      'representative'
    )
    return authz.ok
  }

  return false
}

export async function writeGschAuditLog(
  supabase: SupabaseClient,
  input: {
    actor_id: string
    action: string
    entity_type: string
    entity_id?: string | null
    metadata?: Record<string, unknown>
  }
) {
  await supabase.from('gsch_audit_logs').insert({
    actor_id: input.actor_id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    metadata: input.metadata ?? {},
  })
}
