import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api-client'

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
      await apiClient.post<{ success: true }>('/api/friends', { receiver_id: receiverId })
      return { success: true }
    } catch (error: any) {
      console.error('Error sending friend request:', error)
      return { success: false, error: error?.message ?? 'Failed to send friend request' }
    }
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.patch(`/api/friends/requests/${requestId}`, { status: 'accepted' })
      return { success: true }
    } catch (error: any) {
      console.error('Error accepting friend request:', error)
      return { success: false, error: error?.message ?? 'Failed to accept friend request' }
    }
  }

  /**
   * Decline a friend request
   */
  async declineFriendRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.patch(`/api/friends/requests/${requestId}`, { status: 'declined' })
      return { success: true }
    } catch (error: any) {
      console.error('Error declining friend request:', error)
      return { success: false, error: error?.message ?? 'Failed to decline friend request' }
    }
  }

  /**
   * Cancel a sent friend request
   */
  async cancelFriendRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.delete(`/api/friends/requests/${requestId}`)
      return { success: true }
    } catch (error: any) {
      console.error('Error canceling friend request:', error)
      return { success: false, error: error?.message ?? 'Failed to cancel friend request' }
    }
  }

  /**
   * Remove a friend (unfriend)
   */
  async removeFriend(friendId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.delete(`/api/friends/${friendId}`)
      return { success: true }
    } catch (error: any) {
      console.error('Error removing friend:', error)
      return { success: false, error: error?.message ?? 'Failed to remove friend' }
    }
  }

  /**
   * Get pending friend requests received by current user
   */
  async getPendingRequests(): Promise<FriendRequest[]> {
    try {
      const res = await apiClient.get<{ data: FriendRequest[] }>('/api/friends/requests')
      return res.data ?? []
    } catch (error) {
      console.error('Error fetching pending requests:', error)
      return []
    }
  }

  /**
   * Get sent friend requests (pending)
   */
  async getSentRequests(): Promise<FriendRequest[]> {
    try {
      const res = await apiClient.get<{ data: FriendRequest[] }>('/api/friends/requests/sent')
      return res.data ?? []
    } catch (error) {
      console.error('Error fetching sent requests:', error)
      return []
    }
  }

  /**
   * Get list of friends (accepted requests)
   */
  async getFriends(): Promise<Friend[]> {
    try {
      const res = await apiClient.get<{ data: Friend[] }>('/api/friends')
      return res.data ?? []
    } catch (error) {
      console.error('Error fetching friends:', error)
      return []
    }
  }

  /**
   * Check if two users are friends
   */
  async areFriends(userId: string): Promise<boolean> {
    try {
      const res = await apiClient.get<{ status: string }>(`/api/friends/status/${userId}`)
      return res.status === 'friends'
    } catch (error) {
      return false
    }
  }

  /**
   * Check friend request status with another user
   */
  async getFriendshipStatus(userId: string): Promise<'none' | 'pending_sent' | 'pending_received' | 'friends'> {
    try {
      const res = await apiClient.get<{ status: string }>(`/api/friends/status/${userId}`)
      return (res.status as 'none' | 'pending_sent' | 'pending_received' | 'friends') ?? 'none'
    } catch (error) {
      console.error('Error checking friendship status:', error)
      return 'none'
    }
  }

  /**
   * Get suggested users (not friends, no pending requests)
   */
  async getSuggestedUsers(limit: number = 20): Promise<Friend[]> {
    try {
      const res = await apiClient.get<{ data: Friend[] } | Friend[]>('/api/friends/suggestions', { limit })
      const list = Array.isArray(res) ? res : (res as { data: Friend[] }).data ?? []
      return list.map((u) => ({
        id: u.id,
        username: u.username ?? 'user',
        full_name: u.full_name ?? u.username ?? 'ConnectAfrik User',
        avatar_url: u.avatar_url,
        friends_since: (u as Friend).friends_since ?? '',
        status: u.status,
        last_seen: u.last_seen
      }))
    } catch (error) {
      console.error('Error fetching suggested users:', error)
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
          try {
            const data = await apiClient.get<FriendRequest>(
              `/api/friends/requests/${payload.new.id}`
            )
            if (data) {
              callback(data)
            }
          } catch {
            callback(payload.new as FriendRequest)
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
