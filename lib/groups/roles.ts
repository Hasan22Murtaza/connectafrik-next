export const GROUP_ROLES = ['member', 'manager', 'co_admin', 'admin'] as const

export type GroupRole = (typeof GROUP_ROLES)[number]

export const GROUP_ROLE_RANK: Record<GroupRole, number> = {
  member: 1,
  manager: 2,
  co_admin: 3,
  admin: 4,
}

export const ASSIGNABLE_GROUP_ROLES = ['member', 'manager', 'co_admin'] as const
export type AssignableGroupRole = (typeof ASSIGNABLE_GROUP_ROLES)[number]

export const GROUP_STAFF_ROLES = ['admin', 'co_admin', 'manager'] as const

export function normalizeGroupRole(role: string | null | undefined): GroupRole {
  if (role === 'admin') return 'admin'
  if (role === 'co_admin' || role === 'co-admin' || role === 'coadmin') return 'co_admin'
  if (role === 'manager') return 'manager'
  return 'member'
}

export function groupRoleLabel(role: string | null | undefined): string {
  switch (normalizeGroupRole(role)) {
    case 'admin':
      return 'Admin'
    case 'co_admin':
      return 'Co-admin'
    case 'manager':
      return 'Manager'
    default:
      return 'Member'
  }
}

export function groupRoleRank(role: string | null | undefined): number {
  return GROUP_ROLE_RANK[normalizeGroupRole(role)]
}

export function isAssignableGroupRole(role: string): role is AssignableGroupRole {
  return (ASSIGNABLE_GROUP_ROLES as readonly string[]).includes(role)
}

export function isGroupAdminRole(role: string | null | undefined): boolean {
  return normalizeGroupRole(role) === 'admin'
}

/** Admin, co-admin, and manager. */
export function isGroupStaffRole(role: string | null | undefined): boolean {
  const normalized = normalizeGroupRole(role)
  return normalized === 'admin' || normalized === 'co_admin' || normalized === 'manager'
}

export function canModerateGroupContent(role: string | null | undefined): boolean {
  return isGroupStaffRole(role)
}

export function canManageGroupRoles(role: string | null | undefined): boolean {
  return isGroupStaffRole(role)
}

export function canCreateGroupManagers(role: string | null | undefined): boolean {
  const normalized = normalizeGroupRole(role)
  return normalized === 'co_admin' || normalized === 'admin'
}

export function canRemoveGroupMembers(role: string | null | undefined): boolean {
  const normalized = normalizeGroupRole(role)
  return normalized === 'co_admin' || normalized === 'admin'
}

export function canApproveGroupJoinRequests(role: string | null | undefined): boolean {
  return canRemoveGroupMembers(role)
}

export function canViewGroupComplaints(role: string | null | undefined): boolean {
  return canRemoveGroupMembers(role)
}

export function canEditGroupSettings(role: string | null | undefined): boolean {
  return isGroupAdminRole(role)
}

export function canChangeGroupMemberRole(
  actorRole: string | null | undefined,
  targetRole: string | null | undefined
): boolean {
  const actor = normalizeGroupRole(actorRole)
  const target = normalizeGroupRole(targetRole)
  if (target === 'admin') return false
  if (actor === 'admin') return true
  if (actor === 'co_admin') return target === 'member' || target === 'manager'
  if (actor === 'manager') return target === 'member' || target === 'manager'
  return false
}

export function canAssignGroupRole(
  actorRole: string | null | undefined,
  nextRole: string | null | undefined
): boolean {
  const actor = normalizeGroupRole(actorRole)
  const next = normalizeGroupRole(nextRole)
  if (next === 'admin') return false
  if (actor === 'admin') return next === 'member' || next === 'manager' || next === 'co_admin'
  if (actor === 'co_admin' || actor === 'manager') return next === 'member' || next === 'manager'
  return false
}

export function assignableGroupRoles(actorRole: string | null | undefined): AssignableGroupRole[] {
  return ASSIGNABLE_GROUP_ROLES.filter((role) => canAssignGroupRole(actorRole, role))
}

export function canRestrictGroupMember(
  actorRole: string | null | undefined,
  targetRole: string | null | undefined
): boolean {
  return canModerateGroupContent(actorRole) && groupRoleRank(actorRole) > groupRoleRank(targetRole)
}

export const GROUP_POST_MODERATION_ACTIONS = [
  'hide',
  'unhide',
  'restrict',
  'unrestrict',
  'approve',
  'reject',
] as const

export type GroupPostModerationAction = (typeof GROUP_POST_MODERATION_ACTIONS)[number]

export function isGroupPostModerationAction(value: unknown): value is GroupPostModerationAction {
  return typeof value === 'string' && (GROUP_POST_MODERATION_ACTIONS as readonly string[]).includes(value)
}
