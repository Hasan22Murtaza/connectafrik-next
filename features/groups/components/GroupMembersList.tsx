import React, { useState, useEffect, useRef } from 'react'
import { Users, UserMinus, Clock, X, Ban, MoreHorizontal, Shield } from '@/shared/icons'
import { apiClient } from '@/lib/api-client'
import { GroupMembership } from '@/shared/types'
import { formatDistanceToNow } from 'date-fns'
import { getRoleIcon } from '@/shared/utils/groupUtils'
import toast from 'react-hot-toast'
import { useConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import {
  assignableGroupRoles,
  canChangeGroupMemberRole,
  canManageGroupRoles,
  canRemoveGroupMembers,
  canRestrictGroupMember,
  groupRoleLabel,
  isAssignableGroupRole,
  isGroupAdminRole,
  normalizeGroupRole,
  type AssignableGroupRole,
} from '@/lib/groups/roles'

interface GroupMembersListProps {
  groupId: string
  currentUserId?: string
  viewerRole?: string
  refreshToken?: number
  onMembersChanged?: (info: { member_count?: number; removed_user_id?: string }) => void
}

interface MemberWithProfile extends GroupMembership {
  user: {
    id: string
    username: string
    full_name: string
    avatar_url?: string
  }
}

const ROLE_BADGE_CLASS: Record<string, string> = {
  admin: 'bg-yellow-100 text-yellow-700',
  co_admin: 'bg-orange-100 text-orange-700',
  manager: 'bg-blue-100 text-blue-700',
  member: 'bg-gray-100 text-gray-700',
}

const GroupMembersList: React.FC<GroupMembersListProps> = ({
  groupId,
  currentUserId,
  viewerRole,
  refreshToken = 0,
  onMembersChanged,
}) => {
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [pendingInvites, setPendingInvites] = useState<MemberWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const hasLoadedRef = useRef(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { confirm, dialog } = useConfirmDialog()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const canRemove = canRemoveGroupMembers(viewerRole)
  const canManageRoles = canManageGroupRoles(viewerRole)
  const roleOptions = assignableGroupRoles(viewerRole)

  useEffect(() => {
    fetchMembers({ silent: hasLoadedRef.current })
  }, [groupId, refreshToken])

  const fetchPagedMemberships = async (endpoint: string) => {
    const allRows: MemberWithProfile[] = []
    let page = 0
    let hasMore = true

    while (hasMore) {
      const res = await apiClient.get<{ data: MemberWithProfile[]; hasMore?: boolean }>(
        endpoint,
        { page, limit: 50 }
      )
      const pageRows = res.data || []
      allRows.push(...pageRows)
      hasMore = Boolean(res.hasMore)
      page += 1
      if (pageRows.length === 0) break
    }

    return allRows
  }

  const fetchMembers = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true)

      const [allMembers, invites] = await Promise.all([
        fetchPagedMemberships(`/api/groups/${groupId}/members`),
        fetchPagedMemberships(`/api/groups/${groupId}/invite`).catch(() => [] as MemberWithProfile[]),
      ])

      setMembers(allMembers)
      setPendingInvites(invites)
      hasLoadedRef.current = true
    } catch (error) {
      console.error('Error fetching members:', error)
      if (!opts?.silent) {
        setMembers([])
        setPendingInvites([])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (member: MemberWithProfile, isPendingInvite = false) => {
    if (!canRemove) return
    if (member.user_id === currentUserId) return
    if (!isPendingInvite && isGroupAdminRole(member.role)) {
      toast.error('Cannot remove admin')
      return
    }
    const displayName = member.user?.full_name || member.user?.username || (isPendingInvite ? 'this invite' : 'this member')
    const confirmed = await confirm({
      title: isPendingInvite ? 'Cancel invitation' : 'Remove member',
      message: isPendingInvite
        ? `Cancel the invitation for ${displayName}?`
        : `Remove ${displayName} from the group?`,
      confirmLabel: isPendingInvite ? 'Cancel invite' : 'Remove',
    })
    if (!confirmed) return

    setRemovingMemberId(member.user_id)
    const previousMembers = members
    const previousInvites = pendingInvites
    if (isPendingInvite) {
      setPendingInvites((prev) => prev.filter((m) => m.user_id !== member.user_id))
    } else {
      setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id))
    }
    try {
      const res = await apiClient.delete<{ removed_user_id?: string; member_count?: number }>(
        `/api/groups/${groupId}/members/${member.user_id}`
      )
      onMembersChanged?.({
        member_count: res?.member_count,
        removed_user_id: member.user_id,
      })
      toast.success(isPendingInvite ? 'Invitation cancelled' : 'Member removed')
    } catch (error: unknown) {
      setMembers(previousMembers)
      setPendingInvites(previousInvites)
      const message = error instanceof Error ? error.message : isPendingInvite ? 'Failed to cancel invitation' : 'Failed to remove member'
      toast.error(message)
    } finally {
      setRemovingMemberId(null)
    }
  }

  const handleRoleChange = async (member: MemberWithProfile, role: AssignableGroupRole) => {
    if (!canManageRoles) return
    if (member.user_id === currentUserId) return
    if (isGroupAdminRole(member.role)) return
    if (normalizeGroupRole(member.role) === role) return

    setUpdatingRoleUserId(member.user_id)
    const previousRole = member.role
    setMembers((prev) =>
      prev.map((m) => (m.user_id === member.user_id ? { ...m, role } : m))
    )
    try {
      await apiClient.patch(`/api/groups/${groupId}/members/${member.user_id}`, { role })
      toast.success(`Role updated to ${groupRoleLabel(role)}`)
    } catch (error: unknown) {
      setMembers((prev) =>
        prev.map((m) => (m.user_id === member.user_id ? { ...m, role: previousRole } : m))
      )
      const message = error instanceof Error ? error.message : 'Failed to update role'
      toast.error(message)
    } finally {
      setUpdatingRoleUserId(null)
    }
  }

  const handleTogglePostingRestricted = async (member: MemberWithProfile) => {
    if (member.user_id === currentUserId) return
    const nextValue = !member.posting_restricted
    setUpdatingRoleUserId(member.user_id)
    setMembers((prev) =>
      prev.map((m) => (m.user_id === member.user_id ? { ...m, posting_restricted: nextValue } : m))
    )
    try {
      await apiClient.patch(`/api/groups/${groupId}/members/${member.user_id}`, {
        posting_restricted: nextValue,
      })
      toast.success(nextValue ? 'Member can no longer post' : 'Member can post again')
    } catch (error: unknown) {
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === member.user_id ? { ...m, posting_restricted: member.posting_restricted } : m
        )
      )
      const message = error instanceof Error ? error.message : 'Failed to update posting permission'
      toast.error(message)
    } finally {
      setUpdatingRoleUserId(null)
    }
  }

  const renderPerson = (member: MemberWithProfile, isPendingInvite: boolean) => {
    const displayName = member.user?.full_name || member.user?.username || 'Unknown User'
    const timestamp = isPendingInvite ? (member.updated_at || member.joined_at) : member.joined_at
    const normalizedRole = normalizeGroupRole(member.role)
    const isSelf = member.user_id === currentUserId
    const canEditTarget = !isSelf && canChangeGroupMemberRole(viewerRole, member.role)
    const showRemove = canRemove && canEditTarget
    const showRoleSelect =
      canManageRoles &&
      canEditTarget &&
      roleOptions.some((role) => role !== normalizedRole)
    const showRestrict = canRestrictGroupMember(viewerRole, member.role) && !isSelf
    const showMenu = isPendingInvite ? canRemove : showRestrict || showRemove || showRoleSelect
    const menuId = `${isPendingInvite ? 'invite' : 'member'}-${member.user_id}`
    const isMenuOpen = openMenuId === menuId
    const roleChoices = roleOptions.includes(normalizedRole as AssignableGroupRole)
      ? roleOptions
      : isAssignableGroupRole(normalizedRole)
        ? [normalizedRole, ...roleOptions]
        : roleOptions

    return (
      <div
        key={member.id}
        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
      >
        {member.user?.avatar_url ? (
          <img
            src={member.user.avatar_url}
            alt={displayName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-primary-600 font-semibold">
              {displayName[0].toUpperCase()}
            </span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900 truncate">{displayName}</p>
            {!isPendingInvite && getRoleIcon(member.role)}
            {!isPendingInvite && member.posting_restricted && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600">
                posting restricted
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {isPendingInvite
              ? `Invited ${timestamp ? formatDistanceToNow(new Date(timestamp), { addSuffix: true }) : 'recently'}`
              : `Joined ${formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              isPendingInvite
                ? 'bg-amber-100 text-amber-700'
                : ROLE_BADGE_CLASS[normalizedRole] || ROLE_BADGE_CLASS.member
            }`}
          >
            {isPendingInvite ? 'Pending' : groupRoleLabel(member.role)}
          </span>
          {showMenu && (
            <div className="relative" ref={isMenuOpen ? menuRef : undefined}>
              <button
                type="button"
                onClick={() => setOpenMenuId(isMenuOpen ? null : menuId)}
                disabled={removingMemberId === member.user_id || updatingRoleUserId === member.user_id}
                className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                aria-label={`${displayName} actions`}
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {isMenuOpen && (
                <ul
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-1 m-0 w-52 list-none rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                >
                  {isPendingInvite ? (
                    <li role="none">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOpenMenuId(null)
                          handleRemoveMember(member, true)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                        Cancel invite
                      </button>
                    </li>
                  ) : (
                    <>
                      {showRoleSelect && (
                        <>
                          <li className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                            Change role
                          </li>
                          {roleChoices.map((role) => (
                            <li key={role} role="none">
                              <button
                                type="button"
                                role="menuitem"
                                disabled={role === normalizedRole || updatingRoleUserId === member.user_id}
                                onClick={() => {
                                  setOpenMenuId(null)
                                  handleRoleChange(member, role)
                                }}
                                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 ${
                                  role === normalizedRole ? 'font-semibold text-gray-900' : 'text-gray-700'
                                }`}
                              >
                                <Shield className="h-4 w-4 text-gray-400" />
                                {groupRoleLabel(role)}
                                {role === normalizedRole ? ' (current)' : ''}
                              </button>
                            </li>
                          ))}
                        </>
                      )}
                      {showRestrict && (
                        <li role="none" className={showRoleSelect ? 'border-t border-gray-100' : ''}>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuId(null)
                              handleTogglePostingRestricted(member)
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-amber-700 hover:bg-amber-50"
                          >
                            <Ban className="h-4 w-4" />
                            {member.posting_restricted ? 'Allow posts' : 'Restrict posting'}
                          </button>
                        </li>
                      )}
                      {showRemove && (
                        <li role="none" className={showRestrict || showRoleSelect ? 'border-t border-gray-100' : ''}>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuId(null)
                              handleRemoveMember(member)
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            <UserMinus className="h-4 w-4" />
                            Remove
                          </button>
                        </li>
                      )}
                    </>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (members.length === 0 && pendingInvites.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No members yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {dialog}
      {pendingInvites.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            Pending
            <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center">
              {pendingInvites.length}
            </span>
          </h4>
          <div className="space-y-3">
            {pendingInvites.map((invite) => renderPerson(invite, true))}
          </div>
        </div>
      )}

      {members.length > 0 && (
        <div>
          {pendingInvites.length > 0 && (
            <h4 className="font-medium text-gray-900 mb-3">Members</h4>
          )}
          <div className="space-y-3">
            {members.map((member) => renderPerson(member, false))}
          </div>
        </div>
      )}
    </div>
  )
}

export default GroupMembersList
