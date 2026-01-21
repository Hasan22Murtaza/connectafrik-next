'use client'

import React from 'react'
import { Calendar, MapPin, Users, Clock, Video, Building, Trash2, UserPlus, UserCheck, Globe } from 'lucide-react'
import { GroupEvent } from '@/shared/hooks/useGroupEvents'
import { formatDistanceToNow, format } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'

interface GroupEventsListProps {
  events: GroupEvent[]
  loading: boolean
  onToggleAttendance: (eventId: string) => void
  onDelete?: (eventId: string) => void
  onCreateEvent?: () => void
}

const EVENT_TYPE_LABELS = {
  meeting: 'Meeting',
  action: 'Action',
  workshop: 'Workshop',
  discussion: 'Discussion',
  social: 'Social'
}

const EVENT_TYPE_COLORS = {
  meeting: 'bg-blue-100 text-blue-700',
  action: 'bg-red-100 text-red-700',
  workshop: 'bg-purple-100 text-purple-700',
  discussion: 'bg-green-100 text-green-700',
  social: 'bg-yellow-100 text-yellow-700'
}

const STATUS_COLORS = {
  scheduled: 'bg-green-100 text-green-700',
  ongoing: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700'
}

const GroupEventsList: React.FC<GroupEventsListProps> = ({
  events,
  loading,
  onToggleAttendance,
  onDelete,
  onCreateEvent
}) => {
  const { user } = useAuth()

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No events yet</h3>
        <p className="text-gray-500 mb-4">Be the first to create an event for this group!</p>
        {onCreateEvent && (
          <button
            onClick={onCreateEvent}
            className="btn-primary"
          >
            Create Event
          </button>
        )}
      </div>
    )
  }

  // Separate events by status
  const upcomingEvents = events.filter(e => e.status === 'scheduled' && new Date(e.start_time) > new Date())
  const pastEvents = events.filter(e => e.status === 'completed' || new Date(e.start_time) <= new Date())
  const ongoingEvents = events.filter(e => e.status === 'ongoing')

  return (
    <div className="space-y-6">
      {/* Ongoing Events */}
      {ongoingEvents.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ongoing Events</h3>
          <div className="space-y-4">
            {ongoingEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onToggleAttendance={onToggleAttendance}
                onDelete={onDelete}
                currentUserId={user?.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Events</h3>
          <div className="space-y-4">
            {upcomingEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onToggleAttendance={onToggleAttendance}
                onDelete={onDelete}
                currentUserId={user?.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <div>
          <h3 className="sm:text-lg text-sm font-semibold text-gray-900 mb-4">Past Events</h3>
          <div className="space-y-4">
            {pastEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onToggleAttendance={onToggleAttendance}
                onDelete={onDelete}
                currentUserId={user?.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface EventCardProps {
  event: GroupEvent
  onToggleAttendance: (eventId: string) => void
  onDelete?: (eventId: string) => void
  currentUserId?: string
}

const EventCard: React.FC<EventCardProps> = ({
  event,
  onToggleAttendance,
  onDelete,
  currentUserId
}) => {
  const isCreator = currentUserId === event.creator_id
  const startDate = new Date(event.start_time)
  const endDate = event.end_time ? new Date(event.end_time) : null

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 sm:p-6 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="sm:text-lg text-sm font-semibold text-gray-900">{event.title}</h3>
            <span className={`text-xs px-2 py-1 rounded-full ${EVENT_TYPE_COLORS[event.event_type]}`}>
              {EVENT_TYPE_LABELS[event.event_type]}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[event.status]}`}>
              {event.status}
            </span>
          </div>
          <p className="text-gray-700 mb-4">{event.description}</p>
        </div>
        {isCreator && onDelete && (
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete this event?')) {
                onDelete(event.id)
              }
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Event Details */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="w-5 h-5" />
          <span>
            {format(startDate, 'EEEE, MMMM d, yyyy')} at {format(startDate, 'h:mm a')}
          </span>
        </div>
        {endDate && (
          <div className="flex items-center gap-2 text-gray-600 ml-7">
            <Clock className="w-4 h-4" />
            <span>Ends: {format(endDate, 'h:mm a')}</span>
          </div>
        )}
        {event.location && (
          <div className="flex items-center gap-2 text-gray-600">
            {event.is_virtual ? (
              <Video className="w-5 h-5" />
            ) : (
              <Building className="w-5 h-5" />
            )}
            <span className={event.is_virtual ? 'text-blue-600 hover:underline' : ''}>
              {event.is_virtual ? (
                <a href={event.location} target="_blank" rel="noopener noreferrer">
                  {event.location}
                </a>
              ) : (
                event.location
              )}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 text-gray-600">
          <Users className="w-5 h-5" />
          <span>
            {event.attendee_count} / {event.max_attendees} attendees
          </span>
        </div>
        {event.creator && (
          <div className="flex items-center gap-2 text-gray-600">
            <span className="text-sm">Created by {event.creator.full_name || event.creator.username}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={() => onToggleAttendance(event.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            event.isAttending
              ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {event.isAttending ? (
            <>
              <UserCheck className="w-4 h-4" />
              <span>Attending</span>
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              <span>RSVP</span>
            </>
          )}
        </button>
        {event.is_public && (
          <span className="text-sm text-gray-500 flex items-center gap-1">
            <Globe className="w-4 h-4" />
            Public Event
          </span>
        )}
      </div>
    </div>
  )
}

export default GroupEventsList

