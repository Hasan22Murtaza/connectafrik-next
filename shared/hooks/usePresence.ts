import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { presenceService, PresenceStatus } from '@/shared/services/presenceService'

export const usePresence = () => {
  const { user } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState<PresenceStatus[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize presence tracking
  const initializePresence = useCallback(async () => {
    if (!user?.id || isInitialized) return

    try {
      await presenceService.initializePresence(user.id)
      setIsInitialized(true)
      
      // Set up periodic updates
      const interval = setInterval(async () => {
        const users = await presenceService.getOnlineUsers()
        setOnlineUsers(users)
      }, 5000) // Update every 5 seconds

      return () => clearInterval(interval)
    } catch (error) {
      console.error('Failed to initialize presence:', error)
    }
  }, [user?.id, isInitialized])

  // Update presence status
  const updateStatus = useCallback(async (status: 'online' | 'away' | 'busy' | 'offline') => {
    if (!user?.id) return
    await presenceService.updatePresence(user.id, status)
  }, [user?.id])

  // Set away when tab becomes inactive
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        presenceService.setAway(user?.id || '')
      } else {
        presenceService.updatePresence(user?.id || '', 'online')
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
      presenceService.cleanup()
    }
  }, [])

  return {
    onlineUsers,
    isInitialized,
    updateStatus,
    setAway: () => presenceService.setAway(user?.id || ''),
    setBusy: () => presenceService.setBusy(user?.id || ''),
  }
}

