'use client'

import React, { useState, useEffect } from 'react'
import { X, Search, Check, QrCode, UserPlus } from '@/shared/icons'
import { useAuth } from '@/contexts/AuthContext'
import { friendRequestService } from '@/features/social/services/friendRequestService'
import { apiClient } from '@/lib/api-client'
import toast from 'react-hot-toast'

interface Friend {
  id: string
  username: string
  full_name: string
  avatar_url?: string
}

export type InviteSentResult = {
  added_count: number
  already_member_count: number
  added_user_ids: string[]
  already_member_user_ids: string[]
  already_invited_user_ids?: string[]
  approved_count?: number
  member_count?: number
  emails_sent?: number
}

interface InviteFriendsModalProps {
  isOpen: boolean
  onClose: () => void
  groupId: string
  groupName: string
  onInviteSent?: (result: InviteSentResult) => void
}

const InviteFriendsModal: React.FC<InviteFriendsModalProps> = ({
  isOpen,
  onClose,
  groupId,
  groupName,
  onInviteSent
}) => {
  const { user } = useAuth()
  const [friends, setFriends] = useState<Friend[]>([])
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([])
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [existingMembers, setExistingMembers] = useState<Set<string>>(new Set())
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set())
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')

  useEffect(() => {
    if (isOpen && user) {
      setSelectedFriends(new Set())
      setSearchTerm('')
      setInviteMessage('')
      fetchFriends()
      fetchExistingMembers()
      generateQRCode()
    }
  }, [isOpen, user, groupId])

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = friends.filter(friend =>
        friend.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        friend.username?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredFriends(filtered)
    } else {
      setFilteredFriends(friends)
    }
  }, [searchTerm, friends])

  const fetchFriends = async () => {
    try {
      setLoading(true)
      const friendsList = await friendRequestService.getFriends()
      setFriends(friendsList)
      setFilteredFriends(friendsList)
    } catch (error) {
      console.error('Error fetching friends:', error)
      toast.error('Failed to load friends')
    } finally {
      setLoading(false)
    }
  }

  const fetchExistingMembers = async () => {
    try {
      const memberIds = new Set<string>()
      let page = 0
      let hasMore = true

      while (hasMore) {
        const res = await apiClient.get<{ data: Array<{ user_id: string }>; hasMore?: boolean }>(
          `/api/groups/${groupId}/members`,
          { page, limit: 100 }
        )
        const data = res.data || []
        data.forEach((member) => {
          if (member.user_id) memberIds.add(member.user_id)
        })
        hasMore = Boolean(res.hasMore)
        page += 1
        if (data.length === 0) break
      }

      setExistingMembers(memberIds)

      try {
        const invitedIds = new Set<string>()
        let invitePage = 0
        let inviteHasMore = true
        while (inviteHasMore) {
          const inviteRes = await apiClient.get<{ data: Array<{ user_id: string }>; hasMore?: boolean }>(
            `/api/groups/${groupId}/invite`,
            { page: invitePage, limit: 100 }
          )
          const inviteRows = inviteRes.data || []
          inviteRows.forEach((row) => {
            if (row.user_id) invitedIds.add(row.user_id)
          })
          inviteHasMore = Boolean(inviteRes.hasMore)
          invitePage += 1
          if (inviteRows.length === 0) break
        }
        setInvitedUserIds(invitedIds)
      } catch (inviteError) {
        console.error('Error fetching pending invitations:', inviteError)
      }
    } catch (error) {
      console.error('Error fetching existing members:', error)
    }
  }

  const generateQRCode = () => {
    const inviteUrl = `${window.location.origin}/groups/${groupId}?invite=true`
    const qrCodeServiceUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteUrl)}`
    setQrCodeUrl(qrCodeServiceUrl)
  }

  const isUnavailable = (friendId: string) =>
    existingMembers.has(friendId) || invitedUserIds.has(friendId)

  const toggleFriendSelection = (friendId: string) => {
    if (existingMembers.has(friendId)) {
      toast.error('This friend is already a member of the group')
      return
    }
    if (invitedUserIds.has(friendId)) {
      toast.error('This friend has already been invited')
      return
    }

    setSelectedFriends(prev => {
      const newSet = new Set(prev)
      if (newSet.has(friendId)) {
        newSet.delete(friendId)
      } else {
        newSet.add(friendId)
      }
      return newSet
    })
  }

  const handleSendInvites = async () => {
    if (selectedFriends.size === 0) {
      toast.error('Please select at least one friend to invite')
      return
    }

    if (!user) {
      toast.error('You must be logged in to send invites')
      return
    }

    const targetUserIds = Array.from(selectedFriends).filter((id) => !isUnavailable(id))
    if (targetUserIds.length === 0) {
      toast.error('Selected friends are already members or have already been invited')
      setSelectedFriends(new Set())
      return
    }

    setSending(true)
    try {
      const response = await apiClient.post<{
        added_count?: number
        already_member_count?: number
        added_user_ids?: string[]
        already_member_user_ids?: string[]
        already_invited_user_ids?: string[]
        approved_count?: number
        member_count?: number
        emails_sent?: number
      }>(`/api/groups/${groupId}/invite`, {
        user_ids: targetUserIds,
        message: inviteMessage.trim() || undefined,
      })

      const addedCount = response?.added_count ?? 0
      const alreadyCount = response?.already_member_count ?? 0
      const alreadyInvitedCount = response?.already_invited_user_ids?.length ?? 0
      const approvedCount = response?.approved_count ?? 0
      const addedUserIds = response?.added_user_ids ?? []
      const alreadyMemberIds = response?.already_member_user_ids ?? []

      setExistingMembers((prev) => {
        const next = new Set(prev)
        alreadyMemberIds.forEach((id) => next.add(id))
        return next
      })

      if (addedUserIds.length > 0) {
        setInvitedUserIds((prev) => {
          const next = new Set(prev)
          addedUserIds.forEach((id) => next.add(id))
          return next
        })
      }

      if (addedCount > 0 && alreadyCount > 0) {
        toast.success(`Invitation sent to ${addedCount} friend${addedCount > 1 ? 's' : ''}. ${alreadyCount} already in the group.`)
      } else if (addedCount > 0) {
        toast.success(`Invitation sent to ${addedCount} friend${addedCount > 1 ? 's' : ''}`)
      } else if (alreadyInvitedCount > 0) {
        toast.error('Selected friends have already been invited.')
      } else {
        toast.error('Selected friends are already in this group.')
      }

      setSelectedFriends(new Set())
      onInviteSent?.({
        added_count: addedCount,
        already_member_count: alreadyCount,
        added_user_ids: addedUserIds,
        already_member_user_ids: alreadyMemberIds,
        already_invited_user_ids: response?.already_invited_user_ids,
        approved_count: approvedCount,
        member_count: response?.member_count,
        emails_sent: response?.emails_sent,
      })

      if (addedCount > 0 || approvedCount > 0) {
        onClose()
      }
    } catch (error: unknown) {
      console.error('Error sending invites:', error)
      const message = error instanceof Error ? error.message : 'Failed to send invitations'
      toast.error(message)
    } finally {
      setSending(false)
    }
  }

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return

    const link = document.createElement('a')
    link.href = qrCodeUrl
    link.download = `group-${groupId}-qr-code.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!isOpen) return null

  const availableFriends = filteredFriends.filter((f) => !isUnavailable(f.id))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Invite friends to this group</h2>
            <p className="text-sm text-gray-500 mt-0.5">{groupName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={sending}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search for friends by name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="text-right text-sm text-gray-500 mt-2">
              {selectedFriends.size} friend{selectedFriends.size !== 1 ? 's' : ''} selected
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="invite-message" className="block text-sm font-medium text-gray-700 mb-2">
              Invitation message (optional)
            </label>
            <textarea
              id="invite-message"
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value.slice(0, 500))}
              rows={3}
              placeholder={`Write a short note to include in the invitation email`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{inviteMessage.length}/500</p>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Suggested</h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : availableFriends.length === 0 ? (
              <div className="text-center py-8">
                <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">
                  {searchTerm ? 'No friends found' : 'No friends available to invite'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableFriends.map((friend) => {
                  const isSelected = selectedFriends.has(friend.id)

                  return (
                    <div
                      key={friend.id}
                      onClick={() => toggleFriendSelection(friend.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-primary-50 border-2 border-primary-500'
                          : 'hover:bg-gray-50 border-2 border-transparent'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        {friend.avatar_url ? (
                          <img
                            src={friend.avatar_url}
                            alt={friend.full_name || friend.username}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-gray-500 font-semibold">
                            {(friend.full_name || friend.username || 'U')[0].toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {friend.full_name || friend.username}
                        </p>
                      </div>

                      <div
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'bg-primary-500 border-primary-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <QrCode className="w-6 h-6 text-gray-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 mb-1">Invite via QR code</h3>
                <p className="text-sm text-gray-600 mb-3">
                  You can generate a QR code that when scanned will direct people to your group
                </p>
                {qrCodeUrl && (
                  <div className="flex items-center gap-4">
                    <div className="bg-white p-2 rounded border border-gray-200">
                      <img
                        src={qrCodeUrl}
                        alt="Group QR Code"
                        className="w-32 h-32"
                      />
                    </div>
                    <button
                      onClick={handleDownloadQR}
                      className="btn-secondary text-sm"
                    >
                      Download QR Code
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors font-medium"
            disabled={sending}
          >
            Cancel
          </button>
          <button
            onClick={handleSendInvites}
            disabled={selectedFriends.size === 0 || sending}
            className={`px-4 py-2 rounded-lg transition-colors font-medium ${
              selectedFriends.size === 0 || sending
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {sending ? 'Sending...' : 'Send invites'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default InviteFriendsModal
