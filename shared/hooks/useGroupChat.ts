import { useCallback } from 'react'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { supabaseMessagingService } from '@/features/chat/services/supabaseMessagingService'
import { useAuth } from '@/contexts/AuthContext'
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
        // Check if a group chat thread already exists for this group
        const existingThread = await supabaseMessagingService.findGroupThread(groupId)

        if (existingThread) {
          // Thread exists, just open it
          openThread(existingThread.id)
          return existingThread.id
        }

        // Need to create a new group chat thread
        // If memberIds not provided, fetch group members
        let participants = memberIds || []

        if (!participants.length) {
          const members = await supabaseMessagingService.getGroupMembers(groupId)
          participants = members
            .filter(m => m.user_id !== user.id) // Exclude current user
            .map(m => m.user_id)
        }

        if (participants.length === 0) {
          toast.error('No other members in this group yet')
          return null
        }

        // Map participant IDs to ChatParticipant objects
        const chatParticipants = await supabaseMessagingService.getUsersByIds(participants)

        // Create group chat thread
        const threadId = await startChatWithMembers(chatParticipants, {
          participant_ids: participants,
          type: 'group',
          name: groupName,
          metadata: {
            groupId,
            groupName,
          },
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
