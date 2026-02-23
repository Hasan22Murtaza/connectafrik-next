import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import type { Profile } from '@/shared/types'

export const useProfile = () => {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) {
      fetchProfile()
    } else {
      setProfile(null)
      setLoading(false)
    }
  }, [user?.id])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const res = await apiClient.get<{ data: Profile }>('/api/users/me')
      setProfile(res.data)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      if (!user) throw new Error('No user found')

      await apiClient.patch<{ data: Profile }>('/api/users/me', updates)
      await fetchProfile()
      return { error: null }
    } catch (error: any) {
      return { error: error.message }
    }
  }

  return {
    profile,
    loading,
    error,
    updateProfile,
    refetch: fetchProfile,
  }
}
