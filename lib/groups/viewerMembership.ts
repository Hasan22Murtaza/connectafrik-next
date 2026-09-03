type MembershipRow = {
  id: string
  user_id: string
  role: string
  status: string
  joined_at: string
  updated_at: string
}

export const GROUP_MANAGER_ROLES = ['admin', 'moderator'] as const

export function isGroupManagerRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'moderator'
}

export function formatMembership(groupId: string, row: MembershipRow) {
  return {
    id: row.id,
    group_id: groupId,
    user_id: row.user_id,
    role: row.role,
    status: row.status,
    joined_at: row.joined_at,
    updated_at: row.updated_at,
  }
}

/** Surface active membership and a pending join request to the current viewer. */
export function pickViewerMembership(
  groupId: string,
  memberships: MembershipRow[] | null | undefined,
  userId: string | null
) {
  if (!userId) return undefined
  const row = (memberships || []).find((m) => m.user_id === userId)
  if (!row) return undefined
  if (row.status !== 'active' && row.status !== 'pending') return undefined
  return formatMembership(groupId, row)
}

export function countActiveMembers(memberships: Array<{ status: string }> | null | undefined): number {
  return (memberships || []).filter((m) => m.status === 'active').length
}

export function countPendingJoinRequests(
  memberships: Array<{ status: string }> | null | undefined
): number {
  return (memberships || []).filter((m) => m.status === 'pending').length
}
