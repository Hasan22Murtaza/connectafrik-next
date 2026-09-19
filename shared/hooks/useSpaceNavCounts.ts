'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'

export function useSpaceNavCounts() {
  const { user } = useAuth()
  const [friendRequestCount, setFriendRequestCount] = useState(0)
  const [newOrderCount, setNewOrderCount] = useState(0)

  const fetchCounts = useCallback(async () => {
    if (!user) {
      setFriendRequestCount(0)
      setNewOrderCount(0)
      return
    }

    try {
      const [friendsRes, ordersRes] = await Promise.all([
        apiClient.get<{ friend_request_count: number }>('/api/friends/requests/count'),
        apiClient.get<{ new_order_count: number }>('/api/orders/new-count'),
      ])
      setFriendRequestCount(friendsRes?.friend_request_count ?? 0)
      setNewOrderCount(ordersRes?.new_order_count ?? 0)
    } catch (error) {
      console.error('Error fetching space nav counts:', error)
    }
  }, [user])

  useEffect(() => {
    void fetchCounts()
  }, [fetchCounts])

  return {
    friendRequestCount,
    newOrderCount,
    refreshCounts: fetchCounts,
  }
}
