import React, { useState } from 'react'
import { Calendar, Clock, Users, Video, Mic, MicOff, VideoOff, Share2 } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

interface LiveEvent {
  id: string
  title: string
  description: string
  category: 'politics' | 'culture' | 'education' | 'business' | 'community'
  host: {
    id: string
    username: string
    full_name: string
    avatar_url: string | null
    is_verified: boolean
  }
  scheduled_start: string
  actual_start?: string
  status: 'scheduled' | 'live' | 'ended'
  participant_count: number
  max_participants: number
  is_public: boolean
  thumbnail_url?: string
}

interface LiveEventCardProps {
  event: LiveEvent
  onJoinEvent?: (eventId: string) => void
  onShareEvent?: (eventId: string) => void
  currentUserRole?: 'host' | 'participant' | 'viewer' | null
}

const LiveEventCard: React.FC<LiveEventCardProps> = ({
  event,
  onJoinEvent,
  onShareEvent,
  currentUserRole = null
}) => {
  const [isJoining, setIsJoining] = useState(false)

  const getCategoryInfo = (category: string) => {
    switch (category) {
      case 'politics':
        return { icon: '🏛️', color: 'bg-red-100 text-red-800', label: 'Politics' }
      case 'culture':
        return { icon: '🎭', color: 'bg-green-100 text-green-800', label: 'Culture' }
      case 'education':
        return { icon: '📚', color: 'bg-blue-100 text-blue-800', label: 'Education' }
      case 'business':
        return { icon: '💼', color: 'bg-purple-100 text-purple-800', label: 'Business' }
      case 'community':
        return { icon: '👥', color: 'bg-orange-100 text-orange-800', label: 'Community' }
      default:
        return { icon: '📅', color: 'bg-gray-100 text-gray-800', label: 'Event' }
    }
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'live':
        return { color: 'bg-red-500', text: 'LIVE', pulse: true }
      case 'scheduled':
        return { color: 'bg-blue-500', text: 'SCHEDULED', pulse: false }
      case 'ended':
        return { color: 'bg-gray-500', text: 'ENDED', pulse: false }
      default:
        return { color: 'bg-gray-500', text: 'UNKNOWN', pulse: false }
    }
  }

  const handleJoinEvent = async () => {
    if (!onJoinEvent) return
    
    setIsJoining(true)
    try {
      await onJoinEvent(event.id)
    } catch (error) {
      console.error('Failed to join event:', error)
    } finally {
      setIsJoining(false)
    }
  }

  const categoryInfo = getCategoryInfo(event.category)
  const statusInfo = getStatusInfo(event.status)
  const isLive = event.status === 'live'
  const isScheduled = event.status === 'scheduled'
  const isEnded = event.status === 'ended'

  return (
    <div className="card hover:shadow-lg transition-shadow duration-200">
      {/* Event Thumbnail */}
      <div className="relative">
        {event.thumbnail_url ? (
          <img
            src={event.thumbnail_url}
            alt={event.title}
            className="w-full h-48 object-cover rounded-t-lg"
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-primary-500 to-african-green rounded-t-lg flex items-center justify-center">
            <div className="text-center text-white">
              <span className="text-4xl mb-2 block">{categoryInfo.icon}</span>
              <span className="text-lg font-semibold">Live Event</span>
            </div>
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold text-white ${statusInfo.color} ${
            statusInfo.pulse ? 'animate-pulse' : ''
          }`}>
            {isLive && <span className="w-2 h-2 bg-white rounded-full mr-1"></span>}
            {statusInfo.text}
          </span>
        </div>

        {/* Category Badge */}
        <div className="absolute top-3 right-3">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${categoryInfo.color}`}>
            <span className="mr-1">{categoryInfo.icon}</span>
            {categoryInfo.label}
          </span>
        </div>
      </div>

      {/* Event Content */}
      <div className="p-4">
        {/* Host Info */}
        <div className="flex items-center space-x-3 mb-3">
          {event.host.avatar_url ? (
            <img
              src={event.host.avatar_url}
              alt={event.host.full_name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-gray-600 font-medium text-sm">
                {event.host.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center space-x-1">
              <span className="font-medium text-gray-900 text-sm">{event.host.full_name}</span>
              {event.host.is_verified && (
                <span className="text-blue-500">✓</span>
              )}
            </div>
            <span className="text-gray-500 text-xs">@{event.host.username}</span>
          </div>
        </div>

        {/* Event Title & Description */}
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{event.title}</h3>
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{event.description}</p>

        {/* Event Details */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>
              {format(new Date(event.scheduled_start), 'MMM d, yyyy')}
            </span>
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>
              {isLive 
                ? `Started ${formatDistanceToNow(new Date(event.actual_start!), { addSuffix: true })}` 
                : format(new Date(event.scheduled_start), 'h:mm a')
              }
            </span>
          </div>

          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Users className="w-4 h-4" />
            <span>
              {event.participant_count} / {event.max_participants} participants
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Join/Watch Button */}
          {!isEnded && (
            <button
              onClick={handleJoinEvent}
              disabled={isJoining || event.participant_count >= event.max_participants}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200 ${
                isLive
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Video className="w-4 h-4" />
              <span>
                {isJoining 
                  ? 'Joining...' 
                  : isLive 
                    ? 'Join Live' 
                    : 'Set Reminder'
                }
              </span>
            </button>
          )}

          {/* Share Button */}
          <button
            onClick={() => onShareEvent?.(event.id)}
            className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors duration-200"
            title="Share event"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {/* Host Controls (if user is host) */}
        {currentUserRole === 'host' && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              <button className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-200 transition-colors">
                Edit Event
              </button>
              {isLive && (
                <>
                  <button className="p-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors">
                    <Mic className="w-4 h-4" />
                  </button>
                  <button className="p-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors">
                    <Video className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LiveEventCard