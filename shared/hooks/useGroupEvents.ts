import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

export interface GroupEvent {
  id: string
  group_id: string
  creator_id: string
  title: string
  description: string
  event_type: 'meeting' | 'action' | 'workshop' | 'discussion' | 'social'
  start_time: string
  end_time: string | null
  location: string | null
  is_virtual: boolean
  max_attendees: number
  attendee_count: number
  is_public: boolean
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  creator?: {
    id: string
    username: string
    full_name: string
    avatar_url: string | null
  }
  isAttending?: boolean
}

export const useGroupEvents = (groupId: string, enabled: boolean = true) => {
  const { user } = useAuth()
  const [events, setEvents] = useState<GroupEvent[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    if (!groupId || !enabled) return

    try {
      setLoading(true)
      setError(null)

      const allEvents: GroupEvent[] = []
      let page = 0
      let hasMore = true

      while (hasMore) {
        const res = await apiClient.get<{ data: GroupEvent[]; hasMore?: boolean }>(
          `/api/groups/${groupId}/events`,
          { page, limit: 10 }
        )
        const pageEvents = res.data || []
        allEvents.push(...pageEvents)
        hasMore = Boolean(res.hasMore)
        page += 1

        if (pageEvents.length === 0) break
      }

      setEvents(
        allEvents.map((e: GroupEvent) => ({
          ...e,
          creator: e.creator ?? {
            id: e.creator_id,
            username: 'Unknown',
            full_name: 'Unknown User',
            avatar_url: null
          },
          isAttending: e.isAttending ?? false
        }))
      )
    } catch (err: any) {
      console.error('Error fetching group events:', err)
      setError(err.message)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [groupId, user?.id, enabled])

  useEffect(() => {
    if (!enabled) {
      setEvents([])
      setError(null)
      setLoading(false)
      return
    }
    fetchEvents()
  }, [fetchEvents, enabled])

  const createEvent = async (eventData: {
    title: string
    description: string
    event_type: 'meeting' | 'action' | 'workshop' | 'discussion' | 'social'
    start_time: string
    end_time?: string
    location?: string
    is_virtual: boolean
    max_attendees: number
    is_public: boolean
  }) => {
    if (!user) {
      toast.error('You must be logged in to create an event')
      throw new Error('Not authenticated')
    }

    try {
      const res = await apiClient.post<{ data: GroupEvent }>(`/api/groups/${groupId}/events`, {
        ...eventData,
        attendee_count: 0,
        status: 'scheduled'
      })

      const newEvent: GroupEvent = {
        ...res.data,
        creator: res.data.creator ?? {
          id: user.id,
          username: 'Unknown',
          full_name: 'Unknown User',
          avatar_url: null
        },
        isAttending: false
      }

      setEvents(prev => [newEvent, ...prev])
      toast.success('Event created successfully!')
      return newEvent
    } catch (err: any) {
      console.error('Error creating event:', err)
      toast.error(err.message || 'Failed to create event')
      throw err
    }
  }

  const toggleAttendance = async (eventId: string) => {
    if (!user) {
      toast.error('You must be logged in to RSVP')
      return
    }

    try {
      const res = await apiClient.post<{ attending: boolean; attendee_count: number }>(
        `/api/groups/${groupId}/events/${eventId}/attend`
      )

      setEvents(prev =>
        prev.map(event =>
          event.id === eventId
            ? {
                ...event,
                attendee_count: res.attendee_count,
                isAttending: res.attending
              }
            : event
        )
      )

      if (res.attending) {
        toast.success('You are now attending this event')
      } else {
        toast.success('RSVP removed')
      }
    } catch (err: any) {
      console.error('Error toggling attendance:', err)
      toast.error('Failed to update RSVP')
    }
  }

  const deleteEvent = async (eventId: string) => {
    if (!user) return

    try {
      await apiClient.delete(`/api/groups/${groupId}/events/${eventId}`)

      setEvents(prev => prev.filter(event => event.id !== eventId))
      toast.success('Event deleted successfully')
    } catch (err: any) {
      console.error('Error deleting event:', err)
      toast.error(err.message || 'Failed to delete event')
      throw err
    }
  }

  return {
    events,
    loading,
    error,
    createEvent,
    toggleAttendance,
    deleteEvent,
    refetch: fetchEvents
  }
}
