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

      // Process data to add user's membership info and accurate member count
      const processedGroups = (data || []).map(group => {
        // Count actual active memberships for accurate member_count
        const activeMemberships = (group.memberships || []).filter(
          (m: any) => m.status === 'active'
        )

        // Find current user's membership
        const userMembership = activeMemberships.find(
          (m: any) => m.user_id === user?.id
        )

        return {
          ...group,
          member_count: activeMemberships.length,
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

      // Fix member counts by counting actual active memberships
      // (the !inner join above only returns the current user's membership)
      const groupIds = processedGroups.map((g: any) => g.id)
      if (groupIds.length > 0) {
        const { data: allMemberships } = await supabase
          .from('group_memberships')
          .select('group_id')
          .in('group_id', groupIds)
          .eq('status', 'active')

        const countMap = new Map<string, number>()
        ;(allMemberships || []).forEach((m: any) => {
          countMap.set(m.group_id, (countMap.get(m.group_id) || 0) + 1)
        })

        processedGroups.forEach((g: any) => {
          const actualCount = countMap.get(g.id)
          if (actualCount !== undefined) {
            g.member_count = actualCount
          }
        })
      }

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
    avatar_url?: string
    banner_url?: string
  }) => {
    if (!user) throw new Error('Must be logged in to create a group')

    try {
      // Create the group
      const { data: group, error: groupError } = await supabase
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

      if (groupError) throw groupError

      // Automatically add creator as admin
      const { data: membershipData, error: membershipError } = await supabase
        .from('group_memberships')
        .insert([
          {
            group_id: group.id,
            user_id: user.id,
            role: 'admin',
            status: 'active'
          }
        ])
        .select()
        .single()

      if (membershipError) {
        console.error('Failed to add creator as admin:', membershipError)
        // Continue anyway, but log the error
      }

      // Update member count
      const { error: updateError } = await supabase
        .from('groups')
        .update({ member_count: 1 })
        .eq('id', group.id)

      if (updateError) {
        console.error('Failed to update member count:', updateError)
      }

      // Add to local state with membership
      const groupWithMembership = {
        ...group,
        member_count: 1,
        membership: membershipData ? {
          id: membershipData.id,
          group_id: group.id,
          user_id: user.id,
          role: 'admin',
          status: 'active',
          joined_at: membershipData.joined_at || new Date().toISOString(),
          updated_at: membershipData.updated_at || new Date().toISOString()
        } : {
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
          const { data: updatedMembership, error } = await supabase
            .from('group_memberships')
            .update({ status: 'active' })
            .eq('id', existingMembership.id)
            .select()
            .single()

          if (error) throw error

          // Count actual active memberships for accurate member count
          const { count: actualCount } = await supabase
            .from('group_memberships')
            .select('id', { count: 'exact', head: true })
            .eq('group_id', groupId)
            .eq('status', 'active')

          const newMemberCount = actualCount || 0

          // Update member count in database
          const { error: updateError } = await supabase
            .from('groups')
            .update({ member_count: newMemberCount })
            .eq('id', groupId)

          if (updateError) {
            console.error('Failed to update member count:', updateError)
          }

          // Update local state
          setGroups(prev => prev.map(group =>
            group.id === groupId
              ? {
                  ...group,
                  member_count: newMemberCount,
                  membership: updatedMembership ? {
                    id: updatedMembership.id,
                    group_id: groupId,
                    user_id: user.id,
                    role: updatedMembership.role || 'member',
                    status: updatedMembership.status || 'active',
                    joined_at: updatedMembership.joined_at || new Date().toISOString(),
                    updated_at: updatedMembership.updated_at || new Date().toISOString()
                  } : {
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
      const { data: membershipData, error } = await supabase
        .from('group_memberships')
        .insert([
          {
            group_id: groupId,
            user_id: user.id,
            role: 'member',
            status: 'active'
          }
        ])
        .select()
        .single()

      if (error) throw error

      // Count actual active memberships for accurate member count
      const { count: actualCount } = await supabase
        .from('group_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .eq('status', 'active')

      const newMemberCount = actualCount || 0

      // Update member count in database
      const { error: updateError } = await supabase
        .from('groups')
        .update({ member_count: newMemberCount })
        .eq('id', groupId)

      if (updateError) {
        console.error('Failed to update member count:', updateError)
      }

      // Update local state
      setGroups(prev => prev.map(group =>
        group.id === groupId
          ? {
              ...group,
              member_count: newMemberCount,
              membership: membershipData ? {
                id: membershipData.id,
                group_id: groupId,
                user_id: user.id,
                role: membershipData.role || 'member',
                status: membershipData.status || 'active',
                joined_at: membershipData.joined_at || new Date().toISOString(),
                updated_at: membershipData.updated_at || new Date().toISOString()
              } : {
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

      // Count actual active memberships for accurate member count
      const { count: actualCount } = await supabase
        .from('group_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .eq('status', 'active')

      const newMemberCount = actualCount || 0

      // Update member count in database
      const { error: updateError } = await supabase
        .from('groups')
        .update({ member_count: newMemberCount })
        .eq('id', groupId)

      if (updateError) {
        console.error('Failed to update member count:', updateError)
      }

      // Update local state
      setGroups(prev => prev.map(group => 
        group.id === groupId 
          ? { 
              ...group, 
              member_count: newMemberCount,
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

  const fetchGroupById = async (groupId: string): Promise<Group | null> => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select(`
          *,
          creator:profiles!creator_id(id, username, full_name, avatar_url),
          memberships:group_memberships(id, user_id, role, status, joined_at, updated_at)
        `)
        .eq('id', groupId)
        .eq('is_active', true)
        .single()

      if (error) throw error

      // Count actual active memberships for accurate member_count
      const activeMemberships = (data.memberships || []).filter(
        (m: any) => m.status === 'active'
      )
      const actualMemberCount = activeMemberships.length

      // Sync member_count in DB if it drifted out of sync
      if (data.member_count !== actualMemberCount) {
        supabase
          .from('groups')
          .update({ member_count: actualMemberCount })
          .eq('id', groupId)
          .then(({ error: syncError }) => {
            if (syncError) console.error('Failed to sync member_count:', syncError)
          })
      }

      // Find current user's membership if user is logged in
      const userMembership = user 
        ? activeMemberships.find(
            (m: any) => m.user_id === user.id
          )
        : undefined

      return {
        ...data,
        member_count: actualMemberCount,
        membership: userMembership ? {
          id: userMembership.id,
          group_id: groupId,
          user_id: userMembership.user_id,
          role: userMembership.role,
          status: userMembership.status,
          joined_at: userMembership.joined_at,
          updated_at: userMembership.updated_at
        } : undefined,
        memberships: undefined
      }
    } catch (err: any) {
      console.error('Error fetching group:', err)
      return null
    }
  }

  const fetchManagedGroups = async () => {
    if (!user) return []

    try {
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
        .in('memberships.role', ['admin', 'moderator'])
        .order('created_at', { ascending: false })

      if (error) throw error

      const processedGroups = (data || []).map(group => {
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
          memberships: undefined
        }
      })

      // Fix member counts by counting actual active memberships
      const groupIds = processedGroups.map((g: any) => g.id)
      if (groupIds.length > 0) {
        const { data: allMemberships } = await supabase
          .from('group_memberships')
          .select('group_id')
          .in('group_id', groupIds)
          .eq('status', 'active')

        const countMap = new Map<string, number>()
        ;(allMemberships || []).forEach((m: any) => {
          countMap.set(m.group_id, (countMap.get(m.group_id) || 0) + 1)
        })

        processedGroups.forEach((g: any) => {
          const actualCount = countMap.get(g.id)
          if (actualCount !== undefined) {
            g.member_count = actualCount
          }
        })
      }

      return processedGroups
    } catch (err: any) {
      console.error('Managed groups fetch error:', err)
      return []
    }
  }

  const fetchRecentActivity = async (limit: number = 20) => {
    if (!user) return []

    try {
      // First, get all groups the user is a member of
      const { data: memberships, error: membershipsError } = await supabase
        .from('group_memberships')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (membershipsError) throw membershipsError

      if (!memberships || memberships.length === 0) return []

      const groupIds = memberships.map(m => m.group_id)

      // Fetch recent posts from these groups (include comment count)
      const { data: postsData, error: postsError } = await supabase
        .from('group_posts')
        .select(`
          *,
          group:groups(id, name, avatar_url),
          group_post_comments(count)
        `)
        .in('group_id', groupIds)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (postsError) throw postsError

      if (!postsData || postsData.length === 0) return []

      // Fetch author profiles
      const authorIds = [...new Set(postsData.map(p => p.author_id))]
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, country')
        .in('id', authorIds)

      const profilesMap = new Map(
        (profilesData || []).map(profile => [profile.id, profile])
      )

      // Check which posts the current user has reacted to (using group_post_reactions table)
      let reactionsData: any[] = []
      const { data: userReactions } = await supabase
        .from('group_post_reactions')
        .select('group_post_id')
        .eq('user_id', user.id)
        .in('group_post_id', postsData.map(p => p.id))

      if (userReactions) reactionsData = userReactions

      // Combine posts with author profiles, group info, and real comment count
      const postsWithDetails = postsData.map(post => {
        const realCommentCount = Array.isArray((post as any).group_post_comments) && (post as any).group_post_comments.length > 0
          ? (post as any).group_post_comments[0].count
          : post.comments_count
        return {
          ...post,
          comments_count: realCommentCount,
          author: profilesMap.get(post.author_id) || {
            id: post.author_id,
            username: 'Unknown',
            full_name: 'Unknown User',
            avatar_url: null,
            country: null
          },
          isLiked: reactionsData.some(r => r.group_post_id === post.id)
        }
      })

      return postsWithDetails
    } catch (err: any) {
      console.error('Recent activity fetch error:', err)
      return []
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