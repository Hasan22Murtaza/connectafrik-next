import React, { useEffect, useState } from 'react'
import { X, Check, UserPlus } from 'lucide-react'
import { friendRequestService, FriendRequest } from '@/features/social/services/friendRequestService'
import { supabase } from '@/lib/supabase'

const FriendRequestNotifications: React.FC = () => {
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([])
  const [processing, setProcessing] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadPendingRequests()

    // Subscribe to new friend requests
    const unsubscribe = friendRequestService.subscribeToPendingRequests(async (request) => {
      const { data: { user } } = await supabase.auth.getUser()

      if (user && request.receiver_id === user.id) {
        setPendingRequests((prev) => [request, ...prev])

        // Show browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('New Friend Request', {
            body: `${request.sender?.full_name || 'Someone'} sent you a friend request`,
            icon: request.sender?.avatar_url || '/logo.png',
          })
        }
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const loadPendingRequests = async () => {
    const requests = await friendRequestService.getPendingRequests()
    setPendingRequests(requests)
  }

  const handleAccept = async (requestId: string) => {
    setProcessing((prev) => ({ ...prev, [requestId]: true }))
    try {
      const result = await friendRequestService.acceptFriendRequest(requestId)
      if (result.success) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId))
        // Trigger page reload to update friends list
        window.location.reload()
      } else {
        alert(result.error || 'Failed to accept friend request')
      }
    } catch (error) {
      console.error('Error accepting friend request:', error)
      alert('Failed to accept friend request')
    } finally {
      setProcessing((prev) => ({ ...prev, [requestId]: false }))
    }
  }

  const handleDecline = async (requestId: string) => {
    setProcessing((prev) => ({ ...prev, [requestId]: true }))
    try {
      const result = await friendRequestService.declineFriendRequest(requestId)
      if (result.success) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId))
      } else {
        alert(result.error || 'Failed to decline friend request')
      }
    } catch (error) {
      console.error('Error declining friend request:', error)
      alert('Failed to decline friend request')
    } finally {
      setProcessing((prev) => ({ ...prev, [requestId]: false }))
    }
  }

  if (pendingRequests.length === 0) return null

  return (
    <div className="fixed top-20 right-4 z-50 w-80 max-w-sm space-y-2">
      {pendingRequests.map((request) => (
        <div
          key={request.id}
          className="rounded-lg bg-white p-4 shadow-lg border border-gray-200 animate-slide-in"
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-200">
                {request.sender?.avatar_url ? (
                  <img
                    src={request.sender.avatar_url}
                    alt={request.sender.full_name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                ) : null}
                <span className={request.sender?.avatar_url ? 'hidden' : 'text-lg font-semibold text-gray-600'}>
                  {request.sender?.full_name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {request.sender?.full_name || 'Someone'}
                  </p>
                  <p className="text-xs text-gray-500">wants to connect with you</p>
                </div>
                <UserPlus className="h-5 w-5 text-primary-600" />
              </div>

              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => handleAccept(request.id)}
                  disabled={processing[request.id]}
                  className="flex-1 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {processing[request.id] ? (
                    'Processing...'
                  ) : (
                    <>
                      <Check className="inline h-3 w-3 mr-1" />
                      Accept
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDecline(request.id)}
                  disabled={processing[request.id]}
                  className="flex-1 rounded-md bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-300 disabled:opacity-50 transition-colors"
                >
                  <X className="inline h-3 w-3 mr-1" />
                  Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default FriendRequestNotifications
