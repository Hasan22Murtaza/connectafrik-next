import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
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

export const useGroupEvents = (groupId: string) => {
  const { user } = useAuth()
  const [events, setEvents] = useState<GroupEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    if (!groupId) return

    try {
      setLoading(true)
      setError(null)

      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from('group_events')
        .select('*')
        .eq('group_id', groupId)
        .order('start_time', { ascending: true })

      if (eventsError) throw eventsError

      if (!eventsData || eventsData.length === 0) {
        setEvents([])
        setLoading(false)
        return
      }

      // Fetch creator profiles
      const creatorIds = [...new Set(eventsData.map(e => e.creator_id))]
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', creatorIds)

      const profilesMap = new Map(
        (profilesData || []).map(profile => [profile.id, profile])
      )

      // Check if user is attending events
      let attendingEventIds: string[] = []
      if (user) {
        const { data: attendanceData } = await supabase
          .from('group_event_attendees')
          .select('event_id')
          .eq('user_id', user.id)
          .in('event_id', eventsData.map(e => e.id))

        if (attendanceData) {
          attendingEventIds = attendanceData.map(a => a.event_id)
        }
      }

      // Combine events with creator profiles
      const eventsWithCreators = eventsData.map(event => ({
        ...event,
        creator: profilesMap.get(event.creator_id) || {
          id: event.creator_id,
          username: 'Unknown',
          full_name: 'Unknown User',
          avatar_url: null
        },
        isAttending: attendingEventIds.includes(event.id)
      }))

      setEvents(eventsWithCreators)
    } catch (err: any) {
      console.error('Error fetching group events:', err)
      setError(err.message)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [groupId, user?.id])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

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
      const { data, error } = await supabase
        .from('group_events')
        .insert({
          group_id: groupId,
          creator_id: user.id,
          ...eventData,
          attendee_count: 0,
          status: 'scheduled'
        })
        .select('*')
        .single()

      if (error) throw error

      // Fetch creator profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .eq('id', user.id)
        .single()

      const newEvent: GroupEvent = {
        ...data,
        creator: profileData || {
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
      // Check if already attending
      const { data: existingAttendance } = await supabase
        .from('group_event_attendees')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .single()

      if (existingAttendance) {
        // Remove attendance
        await supabase
          .from('group_event_attendees')
          .delete()
          .eq('id', existingAttendance.id)

        // Update attendee count
        setEvents(prev => prev.map(event => {
          if (event.id === eventId) {
            return {
              ...event,
              attendee_count: Math.max(0, event.attendee_count - 1),
              isAttending: false
            }
          }
          return event
        }))

        toast.success('RSVP removed')
      } else {
        // Add attendance
        await supabase
          .from('group_event_attendees')
          .insert({
            event_id: eventId,
            user_id: user.id
          })

        // Update attendee count
        setEvents(prev => prev.map(event => {
          if (event.id === eventId) {
            return {
              ...event,
              attendee_count: event.attendee_count + 1,
              isAttending: true
            }
          }
          return event
        }))

        toast.success('You are now attending this event')
      }
    } catch (err: any) {
      console.error('Error toggling attendance:', err)
      toast.error('Failed to update RSVP')
    }
  }

  const deleteEvent = async (eventId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('group_events')
        .delete()
        .eq('id', eventId)
        .eq('creator_id', user.id) // Only creator can delete

      if (error) throw error

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

