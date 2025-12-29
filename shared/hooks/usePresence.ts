import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  initializePresence as initPresence,
  updatePresence as updatePresenceStatus,
  getOnlineUsers,
  subscribeToPresenceChanges,
  setAway as setAwayStatus,
  setBusy as setBusyStatus,
  cleanup as cleanupPresence,
  type PresenceStatus,
} from '@/shared/services/presenceService'

export const usePresence = () => {
  const { user } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState<PresenceStatus[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize presence tracking
  const initializePresence = useCallback(async () => {
    if (!user?.id || isInitialized) return

    try {
      await initPresence(user.id)
      setIsInitialized(true)
      
      // Subscribe to presence changes
      const unsubscribe = subscribeToPresenceChanges((userId, status, lastSeen) => {
        setOnlineUsers(prev => {
          const existing = prev.find(u => u.id === userId)
          if (existing) {
            return prev.map(u => 
              u.id === userId 
                ? { ...u, status, lastSeen }
                : u
            )
          } else if (status !== 'offline') {
            return [...prev, { id: userId, status, lastSeen }]
          }
          return prev
        })
      })

      // Set up periodic updates
      const interval = setInterval(async () => {
        const users = await getOnlineUsers()
        setOnlineUsers(users)
      }, 5000) // Update every 5 seconds

      return () => {
        unsubscribe()
        clearInterval(interval)
      }
    } catch (error) {
      console.error('Failed to initialize presence:', error)
    }
  }, [user?.id, isInitialized])

  // Update presence status
  const updateStatus = useCallback(async (status: 'online' | 'away' | 'busy' | 'offline') => {
    if (!user?.id) return
    await updatePresenceStatus(user.id, status)
  }, [user?.id])

  // Set away when tab becomes inactive
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setAwayStatus(user?.id || '')
      } else {
        updatePresenceStatus(user?.id || '', 'online')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user?.id])

  // Initialize on mount
  useEffect(() => {
    initializePresence()
  }, [initializePresence])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (user?.id) {
        cleanupPresence(user.id)
      }
    }
  }, [user?.id])

  return {
    onlineUsers,
    isInitialized,
    updateStatus,
    setAway: () => setAwayStatus(user?.id || ''),
    setBusy: () => setBusyStatus(user?.id || ''),
  }
}

