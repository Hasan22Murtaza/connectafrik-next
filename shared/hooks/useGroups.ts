import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Group, GroupMembership } from '@/shared/types'
import toast from 'react-hot-toast'

export const useGroups = () => {
  const { user } = useAuth()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGroups = async (filters?: {
    category?: string
    search?: string
    country?: string
    limit?: number
  }) => {
    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('groups')
        .select(`
          *,
          creator:profiles!creator_id(id, username, full_name, avatar_url),
          memberships:group_memberships(id, user_id, role, status, joined_at, updated_at)
        `)
        .eq('is_active', true)

      // Apply filters
      if (filters?.category) {
        query = query.eq('category', filters.category)
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
      }

      if (filters?.country) {
        query = query.eq('country', filters.country)
      }

      // Order by member count and recent activity
      query = query
        .order('member_count', { ascending: false })
        .order('created_at', { ascending: false })

      if (filters?.limit) {
        query = query.limit(filters.limit)
      }

      const { data, error } = await query

      if (error) throw error

      // Process data to add user's membership info
      const processedGroups = (data || []).map(group => {
        // Find current user's membership
        const userMembership = group.memberships?.find(
          (m: any) => m.user_id === user?.id && m.status === 'active'
        )

        return {
          ...group,
          membership: userMembership ? {
            id: userMembership.id,
            group_id: group.id,
            user_id: userMembership.user_id,
            role: userMembership.role,
            status: userMembership.status,
            joined_at: userMembership.joined_at,
            updated_at: userMembership.updated_at
          } : undefined,
          // Remove the memberships array to keep data clean
          memberships: undefined
        }
      })

      setGroups(processedGroups)
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

      const { data, error } = await supabase
        .from('groups')
        .select(`
          *,
          creator:profiles!creator_id(id, username, full_name, avatar_url),
          memberships:group_memberships!inner(id, user_id, role, status, joined_at, updated_at)
        `)
        .eq('is_active', true)
        .eq('memberships.user_id', user.id)
        .eq('memberships.status', 'active')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Process data to add user's membership info
      const processedGroups = (data || []).map(group => {
        // Find current user's membership
        const userMembership = group.memberships?.find(
          (m: any) => m.user_id === user.id && m.status === 'active'
        )

        return {
          ...group,
          membership: userMembership ? {
            id: userMembership.id,
            group_id: group.id,
            user_id: userMembership.user_id,
            role: userMembership.role,
            status: userMembership.status,
            joined_at: userMembership.joined_at,
            updated_at: userMembership.updated_at
          } : undefined,
          // Remove the memberships array to keep data clean
          memberships: undefined
        }
      })

      setGroups(processedGroups)
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
  }) => {
    if (!user) throw new Error('Must be logged in to create a group')

    try {
      const { data, error } = await supabase
        .from('groups')
        .insert([
          {
            ...groupData,
            creator_id: user.id,
          }
        ])
        .select(`
          *,
          creator:profiles!creator_id(id, username, full_name, avatar_url)
        `)
        .single()

      if (error) throw error

      // Add to local state
      setGroups(prev => [data, ...prev])
      toast.success('Group created successfully!')
      
      return data
    } catch (err: any) {
      toast.error(err.message || 'Failed to create group')
      throw err
    }
  }

  const joinGroup = async (groupId: string) => {
    if (!user) throw new Error('Must be logged in to join a group')

    try {
      // Check if already a member
      const { data: existingMembership } = await supabase
        .from('group_memberships')
        .select('id, status')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .single()

      if (existingMembership) {
        if (existingMembership.status === 'active') {
          toast.success('You are already a member of this group')
          return
        } else if (existingMembership.status === 'left') {
          // Rejoin by updating status
          const { error } = await supabase
            .from('group_memberships')
            .update({ status: 'active' })
            .eq('id', existingMembership.id)

          if (error) throw error

          // Update local state
          setGroups(prev => prev.map(group =>
            group.id === groupId
              ? {
                  ...group,
                  member_count: group.member_count + 1,
                  membership: {
                    id: existingMembership.id,
                    group_id: groupId,
                    user_id: user.id,
                    role: 'member',
                    status: 'active',
                    joined_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  }
                }
              : group
          ))

          toast.success('Rejoined group successfully!')
          return
        }
      }

      // Create new membership
      const { error } = await supabase
        .from('group_memberships')
        .insert([
          {
            group_id: groupId,
            user_id: user.id,
            role: 'member',
            status: 'active'
          }
        ])

      if (error) throw error

      // Update local state
      setGroups(prev => prev.map(group =>
        group.id === groupId
          ? {
              ...group,
              member_count: group.member_count + 1,
              membership: {
                id: 'temp',
                group_id: groupId,
                user_id: user.id,
                role: 'member',
                status: 'active',
                joined_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            }
          : group
      ))

      toast.success('Joined group successfully!')
    } catch (err: any) {
      console.error('Join group error:', err)
      if (err.message?.includes('unique constraint')) {
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
      const { error } = await supabase
        .from('group_memberships')
        .update({ status: 'left' })
        .eq('group_id', groupId)
        .eq('user_id', user.id)

      if (error) throw error

      // Update local state
      setGroups(prev => prev.map(group => 
        group.id === groupId 
          ? { 
              ...group, 
              member_count: Math.max(0, group.member_count - 1),
              membership: undefined
            }
          : group
      ))

      toast.success('Left group successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave group')
      throw err
    }
  }

  const updateGroup = async (groupId: string, updates: Partial<Group>) => {
    if (!user) throw new Error('Must be logged in to update a group')

    try {
      const { data, error } = await supabase
        .from('groups')
        .update(updates)
        .eq('id', groupId)
        .select(`
          *,
          creator:profiles!creator_id(id, username, full_name, avatar_url)
        `)
        .single()

      if (error) throw error

      // Update local state
      setGroups(prev => prev.map(group => 
        group.id === groupId ? { ...group, ...data } : group
      ))

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
      const { error } = await supabase
        .from('groups')
        .update({ is_active: false })
        .eq('id', groupId)

      if (error) throw error

      // Remove from local state
      setGroups(prev => prev.filter(group => group.id !== groupId))

      toast.success('Group deleted successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete group')
      throw err
    }
  }

  useEffect(() => {
    if (user) {
      fetchGroups()
    }
  }, [user])

  return {
    groups,
    loading,
    error,
    fetchGroups,
    fetchMyGroups,
    createGroup,
    joinGroup,
    leaveGroup,
    updateGroup,
    deleteGroup,
    refetch: fetchGroups
  }
}

export default useGroups