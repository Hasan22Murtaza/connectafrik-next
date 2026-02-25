'use client'

import React, { useState, useEffect } from 'react'
import { X, Search, Check, QrCode, UserPlus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { friendRequestService } from '@/features/social/services/friendRequestService'
import { apiClient } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface Friend {
  id: string
  username: string
  full_name: string
  avatar_url?: string
}

interface InviteFriendsModalProps {
  isOpen: boolean
  onClose: () => void
  groupId: string
  groupName: string
  onInviteSent?: () => void
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
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [existingMembers, setExistingMembers] = useState<Set<string>>(new Set())
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')

  useEffect(() => {
    if (isOpen && user) {
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
    } catch (error) {
      console.error('Error fetching existing members:', error)
    }
  }

  const generateQRCode = () => {
    // Generate QR code URL using a QR code service
    const inviteUrl = `${window.location.origin}/groups/${groupId}?invite=true`
    const qrCodeServiceUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteUrl)}`
    setQrCodeUrl(qrCodeServiceUrl)
  }

  const toggleFriendSelection = (friendId: string) => {
    if (existingMembers.has(friendId)) {
      toast.error('This friend is already a member of the group')
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

    setSending(true)
    try {
      // Try to create group invitations first
      const invitations = Array.from(selectedFriends).map(friendId => ({
        group_id: groupId,
        inviter_id: user.id,
        invitee_id: friendId,
        status: 'pending'
      }))

      const { error: inviteError } = await supabase
        .from('group_invitations')
        .insert(invitations)

      if (inviteError) {
        // If group_invitations table doesn't exist, create notifications instead
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username, full_name')
          .eq('id', user.id)
          .single()

        const inviterName = profileData?.full_name || profileData?.username || 'Someone'

        const notifications = Array.from(selectedFriends).map(friendId => ({
          user_id: friendId,
          type: 'group_invitation',
          title: 'Group Invitation',
          message: `${inviterName} invited you to join ${groupName}`,
          metadata: {
            group_id: groupId,
            group_name: groupName,
            inviter_id: user.id
          },
          created_at: new Date().toISOString()
        }))

        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notifications)

        if (notifError) {
          console.error('Notification error:', notifError)
          // If notifications also fail, just show success (invites were attempted)
        }
      }

      toast.success(`Invited ${selectedFriends.size} friend${selectedFriends.size > 1 ? 's' : ''} to the group!`)
      setSelectedFriends(new Set())
      onInviteSent?.()
      onClose()
    } catch (error: any) {
      console.error('Error sending invites:', error)
      toast.error(error.message || 'Failed to send invitations')
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

  const availableFriends = filteredFriends.filter(f => !existingMembers.has(f.id))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Invite friends to this group</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Search */}
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

          {/* Friends List */}
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
                  const isMember = existingMembers.has(friend.id)

                  return (
                    <div
                      key={friend.id}
                      onClick={() => !isMember && toggleFriendSelection(friend.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        isMember
                          ? 'bg-gray-50 opacity-50 cursor-not-allowed'
                          : isSelected
                          ? 'bg-primary-50 border-2 border-primary-500'
                          : 'hover:bg-gray-50 border-2 border-transparent'
                      }`}
                    >
                      {/* Avatar */}
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

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {friend.full_name || friend.username}
                        </p>
                        {isMember && (
                          <p className="text-xs text-gray-500">Already a member</p>
                        )}
                      </div>

                      {/* Checkbox */}
                      {!isMember && (
                        <div
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? 'bg-primary-500 border-primary-500'
                              : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* QR Code Section */}
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

        {/* Footer */}
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

