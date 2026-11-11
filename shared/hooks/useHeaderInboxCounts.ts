import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { inboxCountsStore } from '@/shared/hooks/inboxCountsStore'

export function useHeaderInboxCounts() {
  const { user } = useAuth()
  const userId = user?.id
  const { currentUser, callRequests } = useProductionChat()
  const [unreadMessages, setUnreadMessages] = useState(() => inboxCountsStore.getState().unreadMessages)
  const [missedCalls, setMissedCalls] = useState(() => inboxCountsStore.getState().missedCalls)

  useEffect(() => {
    inboxCountsStore.setAuth(userId || null)
  }, [userId])

  useEffect(() => {
    inboxCountsStore.setCurrentUser(currentUser?.id, {
      name: currentUser?.name,
      avatarUrl: currentUser?.avatarUrl,
    })
  }, [currentUser?.id, currentUser?.name, currentUser?.avatarUrl])

  useEffect(() => {
    return inboxCountsStore.subscribe((next) => {
      setUnreadMessages(next.unreadMessages)
      setMissedCalls(next.missedCalls)
    })
  }, [])

  const markCallsViewed = useCallback(() => {
    inboxCountsStore.markCallsViewed()
  }, [])

  const incomingCallCount = useMemo(() => Object.keys(callRequests).length, [callRequests])
  const callBadgeCount = Math.max(missedCalls, incomingCallCount)

  return {
    unreadMessages,
    callBadgeCount,
    markCallsViewed,
  }
}
