import React, { useState, useEffect, useRef } from 'react'
import { Search, UserPlus, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { notificationService } from '@/shared/services/notificationService'
import { toast } from 'react-hot-toast'

interface SearchResult {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
  country: string | null
  mutual_friends_count?: number
  is_friend?: boolean
  has_pending_request?: boolean
}

interface UserSearchProps {
  onClose?: () => void
  onUserSelect?: (user: SearchResult) => void
}

export const UserSearch: React.FC<UserSearchProps> = ({ onClose, onUserSelect }) => {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set())
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchRef.current) {
      searchRef.current.focus()
    }
  }, [])

  useEffect(() => {
    if (query.length >= 2) {
      searchUsers()
    } else {
      setResults([])
    }
  }, [query])

  const searchUsers = async () => {
    if (!user || query.length < 2) return

    setLoading(true)
    try {
      // Search for users by username or full name
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          full_name,
          avatar_url,
          country
        `)
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .neq('id', user.id) // Exclude current user
        .limit(20)

      if (error) throw error

      // Get friend status and mutual friends for each result
      const enrichedResults = await Promise.all(
        (data || []).map(async (profile) => {
          // Check if already friends
          const { data: friendCheck } = await supabase
            .from('friend_requests')
            .select('status')
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
            .single()

          // Get mutual friends count
          const { data: mutualFriends } = await supabase.rpc('get_mutual_friends_count', {
            user1_id: user.id,
            user2_id: profile.id
          })

          return {
            ...profile,
            mutual_friends_count: mutualFriends || 0,
            is_friend: friendCheck?.status === 'accepted',
            has_pending_request: friendCheck?.status === 'pending'
          }
        })
      )

      setResults(enrichedResults)
    } catch (error: any) {
      console.error('Error searching users:', error)
      toast.error('Failed to search users')
    } finally {
      setLoading(false)
    }
  }

  const handleSendRequest = async (userId: string) => {
    if (!user) return

    setSendingRequests(prev => new Set(prev).add(userId))

    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: userId,
          status: 'pending'
        })

      if (error) throw error

      // Send push notification to the recipient
      try {
        await notificationService.sendFriendRequestNotification(
          userId, 
          user?.user_metadata?.full_name || user?.email || 'Someone'
        )
      } catch (notificationError) {
        console.error('Error sending push notification:', notificationError)
        // Don't fail the friend request if notification fails
      }

      // Update the result to show pending status
      setResults(prev => prev.map(result => 
        result.id === userId 
          ? { ...result, has_pending_request: true }
          : result
      ))

      toast.success('Friend request sent!')
    } catch (error: any) {
      console.error('Error sending friend request:', error)
      toast.error(error.message || 'Failed to send friend request')
    } finally {
      setSendingRequests(prev => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
    }
  }

  const handleUserClick = (user: SearchResult) => {
    if (onUserSelect) {
      onUserSelect(user)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Search Users</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 text-gray-400 w-4 h-4" style={{ transform: 'translateY(-50%)' }} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by username or name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto mb-2"></div>
              Searching...
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              No users found for "{query}"
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="p-4 text-center text-gray-500">
              Type at least 2 characters to search
            </div>
          )}

          {results.map((result) => (
            <div
              key={result.id}
              className="p-4 border-b hover:bg-gray-50 cursor-pointer"
              onClick={() => handleUserClick(result)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center flex-1 min-w-0" style={{ gap: '12px' }}>
                  {result.avatar_url ? (
                    <img
                      src={result.avatar_url}
                      alt={result.full_name}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-semibold text-primary-700">
                        {result.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {result.full_name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      @{result.username}
                    </p>
                    {result.country && (
                      <p className="text-xs text-gray-400 truncate">
                        {result.country}
                      </p>
                    )}
                    {(result.mutual_friends_count ?? 0) > 0 && (
                      <p className="text-xs text-primary-600 flex items-center" style={{ gap: '4px' }}>
                        <Users className="w-3 h-3" />
                        {result.mutual_friends_count} mutual {result.mutual_friends_count === 1 ? 'friend' : 'friends'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {result.is_friend ? (
                    <span className="px-3 py-1 text-xs font-medium text-green-600 bg-green-100 rounded-full">
                      Friends
                    </span>
                  ) : result.has_pending_request ? (
                    <span className="px-3 py-1 text-xs font-medium text-yellow-600 bg-yellow-100 rounded-full">
                      Pending
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSendRequest(result.id)
                      }}
                      disabled={sendingRequests.has(result.id)}
                      className="px-3 py-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-full flex items-center"
                      style={{ gap: '4px' }}
                    >
                      {sendingRequests.has(result.id) ? (
                        'Sending...'
                      ) : (
                        <>
                          <UserPlus className="w-3 h-3" />
                          Add
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default UserSearch
