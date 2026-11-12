import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import type { Profile } from '@/shared/types'

type ProfileListener = (profile: Profile | null, loading: boolean, error: string | null) => void

let cachedUserId: string | null = null
let cachedProfile: Profile | null = null
let cachedLoading = false
let cachedError: string | null = null
let inflight: Promise<void> | null = null
const listeners = new Set<ProfileListener>()

function emit() {
  for (const listener of listeners) {
    listener(cachedProfile, cachedLoading, cachedError)
  }
}

async function loadProfile(userId: string, force = false) {
  if (!force && cachedUserId === userId && cachedProfile && !cachedLoading) {
    return
  }
  if (!force && inflight && cachedUserId === userId) {
    await inflight
    return
  }

  cachedUserId = userId
  cachedLoading = true
  cachedError = null
  emit()

  inflight = (async () => {
    try {
      const res = await apiClient.get<{ data: Profile }>('/api/users/me', undefined, {
        bypassCache: force,
      })
      if (cachedUserId !== userId) return
      cachedProfile = res.data
      cachedError = null
    } catch (error: unknown) {
      if (cachedUserId !== userId) return
      cachedError = error instanceof Error ? error.message : 'Failed to load profile'
      cachedProfile = null
    } finally {
      if (cachedUserId === userId) {
        cachedLoading = false
        emit()
      }
      inflight = null
    }
  })()

  await inflight
}

function clearProfileCache() {
  cachedUserId = null
  cachedProfile = null
  cachedLoading = false
  cachedError = null
  inflight = null
  apiClient.invalidateCache('/api/users/me')
  emit()
}

export const useProfile = () => {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(
    user?.id && cachedUserId === user.id ? cachedProfile : null
  )
  const [loading, setLoading] = useState<boolean>(Boolean(user?.id) && (cachedLoading || !cachedProfile))
  const [error, setError] = useState<string | null>(
    user?.id && cachedUserId === user.id ? cachedError : null
  )

  useEffect(() => {
    const listener: ProfileListener = (nextProfile, nextLoading, nextError) => {
      setProfile(nextProfile)
      setLoading(nextLoading)
      setError(nextError)
    }
    listeners.add(listener)

    if (!user?.id) {
      clearProfileCache()
      setProfile(null)
      setLoading(false)
      setError(null)
    } else {
      void loadProfile(user.id)
    }

    return () => {
      listeners.delete(listener)
    }
  }, [user?.id])

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      clearProfileCache()
      return
    }
    await loadProfile(user.id, true)
  }, [user?.id])

  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      try {
        if (!user) throw new Error('No user found')
        await apiClient.patch<{ data: Profile }>('/api/users/me', updates)
        apiClient.invalidateCache('/api/users/me')
        await loadProfile(user.id, true)
        return { error: null }
      } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : 'Failed to update profile' }
      }
    },
    [user]
  )

  return {
    profile,
    loading,
    error,
    updateProfile,
    refetch: fetchProfile,
  }
}
