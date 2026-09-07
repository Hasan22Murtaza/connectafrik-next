import {
  GROUP_STAFF_ROLES,
  isGroupStaffRole,
  normalizeGroupRole,
} from '@/lib/groups/roles'

type MembershipRow = {
  id: string
  user_id: string
  role: string
  status: string
  joined_at: string
  updated_at: string
  posting_restricted?: boolean | null
}

export const GROUP_MANAGER_ROLES = GROUP_STAFF_ROLES

export function isGroupManagerRole(role: string | null | undefined): boolean {
  return isGroupStaffRole(role)
}

export function formatMembership(groupId: string, row: MembershipRow) {
  return {
    id: row.id,
    group_id: groupId,
    user_id: row.user_id,
    role: normalizeGroupRole(row.role),
    status: row.status,
    joined_at: row.joined_at,
    updated_at: row.updated_at,
    posting_restricted: Boolean(row.posting_restricted),
  }
}

/** Surface active membership, pending join request, or pending invite to the current viewer. */
export function pickViewerMembership(
  groupId: string,
  memberships: MembershipRow[] | null | undefined,
  userId: string | null
) {
  if (!userId) return undefined
  const row = (memberships || []).find((m) => m.user_id === userId)
  if (!row) return undefined
  if (row.status !== 'active' && row.status !== 'pending' && row.status !== 'invited') return undefined
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
