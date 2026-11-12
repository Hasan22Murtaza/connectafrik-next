'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'

type Listener = (count: number) => void

let sharedUserId: string | null = null
let sharedCount = 0
let inflight: Promise<void> | null = null
const listeners = new Set<Listener>()

function emit(count: number) {
  sharedCount = count
  for (const listener of listeners) listener(count)
}

async function loadCounts(userId: string, force = false) {
  if (!force && inflight && sharedUserId === userId) {
    await inflight
    return
  }

  sharedUserId = userId
  inflight = (async () => {
    try {
      const friendsRes = await apiClient.get<{ friend_request_count: number }>(
        '/api/friends/requests/count',
        undefined,
        force ? { bypassCache: true } : undefined
      )
      if (sharedUserId !== userId) return
      emit(friendsRes?.friend_request_count ?? 0)
    } catch (error) {
      console.error('Error fetching space nav counts:', error)
    } finally {
      inflight = null
    }
  })()

  await inflight
}

export function useSpaceNavCounts() {
  const { user } = useAuth()
  const userId = user?.id
  const [friendRequestCount, setFriendRequestCount] = useState(sharedCount)

  useEffect(() => {
    const listener: Listener = (count) => setFriendRequestCount(count)
    listeners.add(listener)

    if (!userId) {
      sharedUserId = null
      emit(0)
    } else {
      void loadCounts(userId)
    }

    return () => {
      listeners.delete(listener)
    }
  }, [userId])

  const fetchCounts = useCallback(async () => {
    if (!userId) {
      emit(0)
      return
    }
    await loadCounts(userId, true)
  }, [userId])

  return {
    friendRequestCount,
    refreshCounts: fetchCounts,
  }
}
