import { useCallback } from 'react'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'
import toast from 'react-hot-toast'

export const useGroupChat = () => {
  const { user } = useAuth()
  const { startChatWithMembers, openThread } = useProductionChat()

  /**
   * Opens or creates a group chat for a specific group
   * @param groupId The ID of the group
   * @param groupName The name of the group
   * @param memberIds Array of member user IDs (optional - will fetch if not provided)
   */
  const openGroupChat = useCallback(
    async (groupId: string, groupName: string, memberIds?: string[]) => {
      if (!user) {
        toast.error('You must be logged in to chat')
        return null
      }

      try {
        // Prefer API over direct Supabase calls for group chat thread lookup.
        const threadsRes = await apiClient.get<{ data?: Array<{ id: string }> }>(
          '/api/chat/threads',
          { group_id: groupId, limit: 1, page: 0 }
        )
        const existingThread = threadsRes?.data?.[0]

        if (existingThread?.id) {
          // Thread exists, just open it
          openThread(existingThread.id)
          return existingThread.id
        }

        // Need to create a new group chat thread
        // If memberIds not provided, fetch group members
        let participantIds = (memberIds || []).filter((id) => id !== user.id)
        let chatParticipants: Array<{ id: string; name: string; avatarUrl?: string }> = []

        if (!participantIds.length) {
          const membersRes = await apiClient.get<{
            data?: Array<{
              user_id: string
              user?: { full_name?: string | null; username?: string | null; avatar_url?: string | null }
            }>
          }>(`/api/groups/${groupId}/members`, { limit: 200, page: 0 })

          const members = membersRes?.data || []
          const otherMembers = members
            .filter(m => m.user_id !== user.id) // Exclude current user
          participantIds = otherMembers.map(m => m.user_id)

          chatParticipants = otherMembers.map((member) => ({
            id: member.user_id,
            name: member.user?.full_name || member.user?.username || 'Unknown',
            avatarUrl: member.user?.avatar_url || undefined,
          }))
        }

        if (participantIds.length === 0) {
          toast.error('No other members in this group yet')
          return null
        }

        // If IDs are provided externally, hydrate missing participant display fields via group members API.
        if (chatParticipants.length === 0) {
          const membersRes = await apiClient.get<{
            data?: Array<{
              user_id: string
              user?: { full_name?: string | null; username?: string | null; avatar_url?: string | null }
            }>
          }>(`/api/groups/${groupId}/members`, { limit: 200, page: 0 })
          const memberMap = new Map(
            (membersRes?.data || []).map((m) => [m.user_id, m.user])
          )

          chatParticipants = participantIds.map((id) => {
            const profile = memberMap.get(id)
            return {
              id,
              name: profile?.full_name || profile?.username || 'Unknown',
              avatarUrl: profile?.avatar_url || undefined,
            }
          })
        }

        // Create group chat thread
        const threadId = await startChatWithMembers(chatParticipants, {
          participant_ids: participantIds,
          type: 'group',
          name: groupName,
          group_id: groupId,
          openInDock: true,
        })

        if (threadId) {
          toast.success(`Group chat opened: ${groupName}`)
        }

        return threadId
      } catch (error: any) {
        console.error('Error opening group chat:', error)
        toast.error('Failed to open group chat')
        return null
      }
    },
    [user, startChatWithMembers, openThread]
  )

  return {
    openGroupChat,
  }
}
