import { supabase } from '@/lib/supabase'
import { notificationService } from '@/shared/services/notificationService'

export interface FriendRequest {
  id: string
  sender_id: string
  receiver_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  updated_at: string
  sender?: {
    id: string
    username: string
    full_name: string
    avatar_url?: string
  }
  receiver?: {
    id: string
    username: string
    full_name: string
    avatar_url?: string
  }
}

export interface Friend {
  id: string
  username: string
  full_name: string
  avatar_url?: string
  friends_since: string
  status?: string
  last_seen?: string
}

class FriendRequestService {
  /**
   * Send a friend request to another user
   */
  async sendFriendRequest(receiverId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { success: false, error: 'Not authenticated' }
      }

      // Check if already friends or request exists
      const { data: existing } = await supabase
        .from('friend_requests')
        .select('id, status')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
        .maybeSingle()

      if (existing) {
        if (existing.status === 'accepted') {
          return { success: false, error: 'Already friends' }
        }
        if (existing.status === 'pending') {
          return { success: false, error: 'Friend request already sent' }
        }
      }

      // Send friend request
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          status: 'pending'
        })

      if (error) {
        console.error('Error sending friend request:', error)
        return { success: false, error: error.message }
      }

      // Send push notification to the recipient
      try {
        const senderName = user.user_metadata?.full_name || user.email || 'Someone'
        await notificationService.sendNotification({
          user_id: receiverId,
          title: 'New Friend Request',
          body: `${senderName} wants to be your friend on ConnectAfrik`,
          notification_type: 'friend_request',
          data: {
            sender_id: user.id,
            sender_name: senderName,
            url: '/friends'
          }
        })
      } catch (notificationError) {
        console.error('Error sending push notification:', notificationError)
        // Don't fail the friend request if notification fails
      }

      return { success: true }
    } catch (error: any) {
      console.error('Unexpected error sending friend request:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId)

      if (error) {
        console.error('Error accepting friend request:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('Unexpected error accepting friend request:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Decline a friend request
   */
  async declineFriendRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'declined' })
        .eq('id', requestId)

      if (error) {
        console.error('Error declining friend request:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('Unexpected error declining friend request:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Cancel a sent friend request
   */
  async cancelFriendRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId)

      if (error) {
        console.error('Error canceling friend request:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('Unexpected error canceling friend request:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Remove a friend (unfriend)
   */
  async removeFriend(friendId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { success: false, error: 'Not authenticated' }
      }

      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
        .eq('status', 'accepted')

      if (error) {
        console.error('Error removing friend:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error: any) {
      console.error('Unexpected error removing friend:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get pending friend requests received by current user
   */
  async getPendingRequests(): Promise<FriendRequest[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          *,
          sender:profiles!friend_requests_sender_id_profiles_fkey(id, username, full_name, avatar_url)
        `)
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching pending requests:', error)
        return []
      }

      return (data || []).map(req => ({
        ...req,
        sender: Array.isArray(req.sender) ? req.sender[0] : req.sender
      })) as FriendRequest[]
    } catch (error) {
      console.error('Unexpected error fetching pending requests:', error)
      return []
    }
  }

  /**
   * Get sent friend requests (pending)
   */
  async getSentRequests(): Promise<FriendRequest[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          *,
          receiver:profiles!friend_requests_receiver_id_profiles_fkey(id, username, full_name, avatar_url)
        `)
        .eq('sender_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching sent requests:', error)
        return []
      }

      return (data || []).map(req => ({
        ...req,
        receiver: Array.isArray(req.receiver) ? req.receiver[0] : req.receiver
      })) as FriendRequest[]
    } catch (error) {
      console.error('Unexpected error fetching sent requests:', error)
      return []
    }
  }

  /**
   * Get list of friends (accepted requests)
   */
  async getFriends(): Promise<Friend[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          *,
          sender:profiles!friend_requests_sender_id_profiles_fkey(id, username, full_name, avatar_url, status, last_seen),
          receiver:profiles!friend_requests_receiver_id_profiles_fkey(id, username, full_name, avatar_url, status, last_seen)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching friends:', error)
        return []
      }

      // Map to friend objects (the other person in the friendship)
      return (data || []).map(req => {
        const friend = req.sender_id === user.id ? req.receiver : req.sender
        const friendData = Array.isArray(friend) ? friend[0] : friend

        return {
          id: friendData.id,
          username: friendData.username,
          full_name: friendData.full_name,
          avatar_url: friendData.avatar_url,
          friends_since: req.created_at,
          status: friendData.status,
          last_seen: friendData.last_seen
        }
      })
    } catch (error) {
      console.error('Unexpected error fetching friends:', error)
      return []
    }
  }

  /**
   * Check if two users are friends
   */
  async areFriends(userId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      const { data, error } = await supabase
        .from('friend_requests')
        .select('id')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .eq('status', 'accepted')
        .maybeSingle()

      return !!data && !error
    } catch (error) {
      return false
    }
  }

  /**
   * Check friend request status with another user
   */
  async getFriendshipStatus(userId: string): Promise<'none' | 'pending_sent' | 'pending_received' | 'friends'> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return 'none'

      const { data, error } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id, status')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .maybeSingle()

      if (error || !data) return 'none'

      if (data.status === 'accepted') return 'friends'
      if (data.status === 'pending') {
        return data.sender_id === user.id ? 'pending_sent' : 'pending_received'
      }

      return 'none'
    } catch (error) {
      return 'none'
    }
  }

  /**
   * Get suggested users (not friends, no pending requests)
   */
  async getSuggestedUsers(limit: number = 20): Promise<Friend[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      // Get all users
      const { data: allUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, status, last_seen')
        .neq('id', user.id) // Exclude current user
        .limit(limit + 50) // Fetch extra to filter later

      if (usersError || !allUsers) return []

      // Get all friend requests (any status) to filter them out
      const { data: requests } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)

      const connectedUserIds = new Set<string>()
      requests?.forEach(req => {
        connectedUserIds.add(req.sender_id)
        connectedUserIds.add(req.receiver_id)
      })

      // Filter out friends and pending requests
      const suggested = allUsers
        .filter(u => !connectedUserIds.has(u.id))
        .slice(0, limit)
        .map(u => ({
          id: u.id,
          username: u.username || 'user',
          full_name: u.full_name || u.username || 'ConnectAfrik User',
          avatar_url: u.avatar_url,
          friends_since: '',
          status: u.status,
          last_seen: u.last_seen
        }))

      return suggested
    } catch (error) {
      console.error('Unexpected error fetching suggested users:', error)
      return []
    }
  }

  /**
   * Subscribe to friend request changes (Realtime)
   */
  subscribeToPendingRequests(callback: (request: FriendRequest) => void): () => void {
    const channel = supabase
      .channel('friend_requests_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friend_requests'
        },
        async (payload) => {
          // Fetch full request with sender info
          const { data } = await supabase
            .from('friend_requests')
            .select(`
              *,
              sender:profiles!friend_requests_sender_id_profiles_fkey(id, username, full_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            callback(data as FriendRequest)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }
}

export const friendRequestService = new FriendRequestService()
