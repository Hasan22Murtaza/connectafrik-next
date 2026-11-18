import type { SupabaseClient } from '@supabase/supabase-js'
import type { FamilyMember, FamilyMemberRole } from '@/shared/types/family'

export class FamilyAuthError extends Error {
  constructor(
    message: string,
    public status: number = 403
  ) {
    super(message)
    this.name = 'FamilyAuthError'
  }
}

type MemberRow = Pick<
  FamilyMember,
  | 'id'
  | 'family_id'
  | 'user_id'
  | 'role'
  | 'status'
  | 'relationship'
  | 'parental_oversight_enabled'
  | 'joined_at'
  | 'created_at'
  | 'updated_at'
>

const MEMBER_SELECT =
  'id, family_id, user_id, role, status, relationship, parental_oversight_enabled, joined_at, created_at, updated_at'

function normalizeMemberRow(row: MemberRow | null): MemberRow | null {
  if (!row) return null
  return {
    ...row,
    parental_oversight_enabled: Boolean(row.parental_oversight_enabled),
  }
}

export async function getActiveMembership(
  supabase: SupabaseClient,
  userId: string
): Promise<MemberRow | null> {
  const { data, error } = await supabase
    .from('family_members')
    .select(MEMBER_SELECT)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return normalizeMemberRow(data as MemberRow | null)
}

export async function getMembershipById(
  supabase: SupabaseClient,
  memberId: string
): Promise<MemberRow | null> {
  const { data, error } = await supabase
    .from('family_members')
    .select(MEMBER_SELECT)
    .eq('id', memberId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return normalizeMemberRow(data as MemberRow | null)
}

export async function requireActiveMembership(
  supabase: SupabaseClient,
  userId: string
): Promise<MemberRow> {
  const membership = await getActiveMembership(supabase, userId)
  if (!membership) {
    throw new FamilyAuthError('You are not an active family member', 403)
  }
  return membership
}

export async function requireParentOfFamily(
  supabase: SupabaseClient,
  userId: string,
  familyId: string
): Promise<MemberRow> {
  const membership = await getActiveMembership(supabase, userId)
  if (!membership || membership.family_id !== familyId || membership.role !== 'parent') {
    throw new FamilyAuthError('Only a parent in this family can perform this action', 403)
  }
  return membership
}

export async function requireParentOfMember(
  supabase: SupabaseClient,
  parentUserId: string,
  targetMemberId: string
): Promise<{ parent: MemberRow; target: MemberRow }> {
  const [parent, target] = await Promise.all([
    getActiveMembership(supabase, parentUserId),
    getMembershipById(supabase, targetMemberId),
  ])

  if (!parent || parent.role !== 'parent') {
    throw new FamilyAuthError('Only a parent can manage family members', 403)
  }
  if (!target || target.status === 'removed') {
    throw new FamilyAuthError('Family member not found', 404)
  }
  if (parent.family_id !== target.family_id) {
    throw new FamilyAuthError('You cannot manage members of another family', 403)
  }
  return { parent, target }
}

/**
 * Parent may apply parental controls / monitoring only for:
 * - Child members (always)
 * - Teen members who opted into parental oversight
 */
export async function requireParentCanManageMember(
  supabase: SupabaseClient,
  parentUserId: string,
  targetMemberId: string
): Promise<{ parent: MemberRow; target: MemberRow }> {
  const result = await requireParentOfMember(supabase, parentUserId, targetMemberId)
  if (!isParentalControlsActive(result.target)) {
    throw new FamilyAuthError(
      result.target.role === 'teen'
        ? 'This teen has not allowed parental monitoring or controls'
        : 'Parental controls do not apply to this family member',
      403
    )
  }
  return result
}

/** Roles that can optionally be under parental controls. */
export function isChildOrTeenRole(role: FamilyMemberRole): boolean {
  return role === 'child' || role === 'teen'
}

/**
 * @deprecated Prefer isChildOrTeenRole / isParentalControlsActive.
 * Kept as alias for child|teen eligibility checks.
 */
export function isManagedRole(role: FamilyMemberRole): boolean {
  return isChildOrTeenRole(role)
}

/** Whether parental restrictions currently apply to this membership. */
export function isParentalControlsActive(membership: {
  role: FamilyMemberRole
  status?: string
  parental_oversight_enabled?: boolean | null
}): boolean {
  if (membership.status && membership.status !== 'active') return false
  if (membership.role === 'child') return true
  if (membership.role === 'teen') return membership.parental_oversight_enabled === true
  return false
}

/** Whether a parent may manage a target member in the same family. */
export function canParentManageTarget(params: {
  parentFamilyId: string
  parentRole: FamilyMemberRole
  parentStatus: string
  targetFamilyId: string
  targetStatus: string
}): boolean {
  return (
    params.parentRole === 'parent' &&
    params.parentStatus === 'active' &&
    params.targetStatus !== 'removed' &&
    params.parentFamilyId === params.targetFamilyId
  )
}

export function canChildManageFamily(): boolean {
  return false
}
