import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { Group, GroupMembership } from '@/shared/types'
import toast from 'react-hot-toast'

export const useGroups = () => {
  const { user } = useAuth()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAllPages = async <T,>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    limit: number = 50
  ): Promise<T[]> => {
    const allItems: T[] = []
    let page = 0
    let hasMore = true

    while (hasMore) {
      const queryParams: Record<string, string | number | boolean | undefined> = {
        ...(params || {}),
        page,
        limit,
      }

      const res = await apiClient.get<{ data: T[]; hasMore?: boolean }>(endpoint, queryParams)
      const items = res.data || []
      allItems.push(...items)
      hasMore = Boolean(res.hasMore)
      page += 1
      if (items.length === 0) break
    }

    return allItems
  }

  const fetchGroups = async (filters?: {
    category?: string
    search?: string
    country?: string
    limit?: number
  }) => {
    try {
      setLoading(true)
      setError(null)

      const params: Record<string, string | number | boolean | undefined> = {}
      if (filters?.category) params.category = filters.category
      if (filters?.search) params.search = filters.search
      if (filters?.country) params.country = filters.country
      if (filters?.limit) params.limit = filters.limit

      const list = await fetchAllPages<Group>(
        '/api/groups',
        Object.keys(params).length ? params : undefined,
        filters?.limit ? Math.min(filters.limit, 100) : 50
      )
      setGroups(list)
    } catch (err: any) {
      console.error('Groups fetch error:', err)
      setError(err.message)
      setGroups([])
      toast.error('Failed to load groups')
    } finally {
      setLoading(false)
    }
  }

  const fetchMyGroups = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const list = await fetchAllPages<Group>('/api/groups/mine', undefined, 50)
      setGroups(list)
    } catch (err: any) {
      console.error('My groups fetch error:', err)
      setError(err.message)
      setGroups([])
      toast.error('Failed to load your groups')
    } finally {
      setLoading(false)
    }
  }

  const createGroup = async (groupData: {
    name: string
    description: string
    category: string
    goals: string[]
    is_public: boolean
    max_members: number
    location?: string
    country?: string
    tags: string[]
    rules: string[]
    avatar_url?: string
    banner_url?: string
  }) => {
    if (!user) throw new Error('Must be logged in to create a group')

    try {
      const res = await apiClient.post<{ data: Group }>('/api/groups', groupData)
      const group = res.data

      const groupWithMembership: Group = {
        ...group,
        member_count: group.member_count ?? 1,
        membership: group.membership ?? {
          id: 'temp',
          group_id: group.id,
          user_id: user.id,
          role: 'admin',
          status: 'active',
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }

      setGroups(prev => [groupWithMembership, ...prev])
      toast.success('Group created successfully!')
      return groupWithMembership
    } catch (err: any) {
      toast.error(err.message || 'Failed to create group')
      throw err
    }
  }

  const joinGroup = async (groupId: string) => {
    if (!user) throw new Error('Must be logged in to join a group')

    try {
      const res = await apiClient.post<{
        data: { membership: GroupMembership; member_count: number; alreadyMember?: boolean }
      }>(`/api/groups/${groupId}/join`)

      const { membership, member_count, alreadyMember } = res.data

      if (alreadyMember) {
        toast.success('You are already a member of this group')
        return
      }

      setGroups(prev =>
        prev.map(group =>
          group.id === groupId
            ? {
                ...group,
                member_count,
                membership: membership
                  ? {
                      id: membership.id,
                      group_id: groupId,
                      user_id: user.id,
                      role: membership.role || 'member',
                      status: membership.status || 'active',
                      joined_at: membership.joined_at || new Date().toISOString(),
                      updated_at: membership.updated_at || new Date().toISOString(),
                    }
                  : {
                      id: 'temp',
                      group_id: groupId,
                      user_id: user.id,
                      role: 'member',
                      status: 'active',
                      joined_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
              }
            : group
        )
      )

      toast.success('Joined group successfully!')
    } catch (err: any) {
      console.error('Join group error:', err)
      if (err.message?.includes('unique constraint') || err.message?.toLowerCase().includes('already')) {
        toast.error('You are already a member of this group')
      } else {
        toast.error(err.message || 'Failed to join group')
      }
      throw err
    }
  }

  const leaveGroup = async (groupId: string) => {
    if (!user) throw new Error('Must be logged in to leave a group')

    try {
      await apiClient.post(`/api/groups/${groupId}/leave`)

      setGroups(prev =>
        prev.map(group =>
          group.id === groupId ? { ...group, member_count: Math.max(0, (group.member_count ?? 0) - 1), membership: undefined } : group
        )
      )

      toast.success('Left group successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave group')
      throw err
    }
  }

  const updateGroup = async (groupId: string, updates: Partial<Group>) => {
    if (!user) throw new Error('Must be logged in to update a group')

    try {
      const res = await apiClient.patch<{ data: Group }>(`/api/groups/${groupId}`, updates)
      const data = res.data

      setGroups(prev => prev.map(group => (group.id === groupId ? { ...group, ...data } : group)))

      toast.success('Group updated successfully!')
      return data
    } catch (err: any) {
      toast.error(err.message || 'Failed to update group')
      throw err
    }
  }

  const deleteGroup = async (groupId: string) => {
    if (!user) throw new Error('Must be logged in to delete a group')

    try {
      await apiClient.delete<{ success: boolean }>(`/api/groups/${groupId}`)

      setGroups(prev => prev.filter(group => group.id !== groupId))

      toast.success('Group deleted successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete group')
      throw err
    }
  }

  const fetchGroupById = async (groupId: string): Promise<Group | null> => {
    try {
      const res = await apiClient.get<{ data: Group }>(`/api/groups/${groupId}`)
      return res.data
    } catch (err: any) {
      console.error('Error fetching group:', err)
      return null
    }
  }

  const fetchManagedGroups = async (): Promise<Group[]> => {
    if (!user) return []

    try {
      return await fetchAllPages<Group>('/api/groups/managed', undefined, 50)
    } catch (err: any) {
      console.error('Managed groups fetch error:', err)
      return []
    }
  }

  const fetchRecentActivity = async (limit: number = 20) => {
    if (!user) return []

    try {
      return await fetchAllPages<any>('/api/groups/activity', undefined, Math.min(limit, 50))
    } catch (err: any) {
      console.error('Recent activity fetch error:', err)
      return []
    }
  }

  useEffect(() => {
    if (user?.id) {
      fetchGroups()
    }
  }, [user?.id])

  return {
    groups,
    loading,
    error,
    fetchGroups,
    fetchMyGroups,
    fetchManagedGroups,
    fetchRecentActivity,
    fetchGroupById,
    createGroup,
    joinGroup,
    leaveGroup,
    updateGroup,
    deleteGroup,
    refetch: fetchGroups
  }
}

export default useGroups
