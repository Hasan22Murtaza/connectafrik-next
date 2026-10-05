'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'

export function useSpaceNavCounts() {
  const { user } = useAuth()
  const userId = user?.id
  const [friendRequestCount, setFriendRequestCount] = useState(0)

  const fetchCounts = useCallback(async () => {
    if (!userId) {
      setFriendRequestCount(0)
      return
    }

    try {
      const friendsRes = await apiClient.get<{ friend_request_count: number }>(
        '/api/friends/requests/count'
      )
      setFriendRequestCount(friendsRes?.friend_request_count ?? 0)
    } catch (error) {
      console.error('Error fetching space nav counts:', error)
    }
  }, [userId])

  useEffect(() => {
    void fetchCounts()
  }, [fetchCounts])

  return {
    friendRequestCount,
    refreshCounts: fetchCounts,
  }
}
