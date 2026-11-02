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
  'id' | 'family_id' | 'user_id' | 'role' | 'status' | 'relationship' | 'joined_at' | 'created_at' | 'updated_at'
>

export async function getActiveMembership(
  supabase: SupabaseClient,
  userId: string
): Promise<MemberRow | null> {
  const { data, error } = await supabase
    .from('family_members')
    .select('id, family_id, user_id, role, status, relationship, joined_at, created_at, updated_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

export async function getMembershipById(
  supabase: SupabaseClient,
  memberId: string
): Promise<MemberRow | null> {
  const { data, error } = await supabase
    .from('family_members')
    .select('id, family_id, user_id, role, status, relationship, joined_at, created_at, updated_at')
    .eq('id', memberId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
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

export function isManagedRole(role: FamilyMemberRole): boolean {
  return role === 'child' || role === 'teen'
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
