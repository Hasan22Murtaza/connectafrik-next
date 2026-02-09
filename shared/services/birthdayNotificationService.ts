import { supabase } from '@/lib/supabase'
import { notificationService } from '@/shared/services/notificationService'

interface BirthdayUser {
  id: string
  full_name: string
  username: string
  birthday: string
}

/**
 * Checks for upcoming birthdays and creates notifications for connected users
 * This should be called daily (can be triggered via cron job or on app load)
 */
export const checkUpcomingBirthdays = async (currentUserId: string) => {
  try {
    // Get current user's connections (followers/following)
    const { data: connections, error: connectionsError } = await supabase
      .from('follows')
      .select('following_id, follower_id')
      .or(`follower_id.eq.${currentUserId},following_id.eq.${currentUserId}`)

    if (connectionsError) {
      console.error('Error fetching connections:', connectionsError)
      return
    }

    // Get unique connected user IDs
    const connectedUserIds = new Set<string>()
    connections?.forEach((conn) => {
      if (conn.follower_id === currentUserId) {
        connectedUserIds.add(conn.following_id)
      } else {
        connectedUserIds.add(conn.follower_id)
      }
    })

    if (connectedUserIds.size === 0) return

    // Get profiles with birthdays
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, username, birthday')
      .in('id', Array.from(connectedUserIds))
      .not('birthday', 'is', null)

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return
    }

    // Get today's and tomorrow's date (MM-DD format)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayKey = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const tomorrowKey = `${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

    const todayBirthdays: BirthdayUser[] = []
    const tomorrowBirthdays: BirthdayUser[] = []

    profiles?.forEach((profile) => {
      if (!profile.birthday) return

      const parts = String(profile.birthday).split('-')
      if (parts.length < 3) return

      const month = parts[1] || ''
      const day = parts[2] || ''
      const birthdayKey = `${month.padStart(2, '0')}-${day.padStart(2, '0')}`

      if (birthdayKey === todayKey) {
        todayBirthdays.push(profile as BirthdayUser)
      } else if (birthdayKey === tomorrowKey) {
        tomorrowBirthdays.push(profile as BirthdayUser)
      }
    })

    // Create notifications for today's birthdays
    for (const user of todayBirthdays) {
      await createBirthdayNotification(currentUserId, user, 'today')
    }

    // Create notifications for tomorrow's birthdays
    for (const user of tomorrowBirthdays) {
      await createBirthdayNotification(currentUserId, user, 'tomorrow')
    }

    return {
      today: todayBirthdays,
      tomorrow: tomorrowBirthdays,
    }
  } catch (error) {
    console.error('Error checking birthdays:', error)
  }
}

/**
 * Creates a birthday notification for a user
 */
const createBirthdayNotification = async (
  userId: string,
  birthdayUser: BirthdayUser,
  when: 'today' | 'tomorrow'
) => {
  try {
    // Check if notification already exists for today
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'birthday')
      .eq('data->>birthday_user_id', birthdayUser.id)
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .single()

    if (existing) {
      console.log('Birthday notification already exists')
      return
    }

    const title = when === 'today'
      ? `🎂 ${birthdayUser.full_name}'s Birthday!`
      : `🎂 Upcoming Birthday`

    const message = when === 'today'
      ? `Today is ${birthdayUser.full_name}'s birthday! Send them a message to celebrate.`
      : `${birthdayUser.full_name}'s birthday is tomorrow! Don't forget to wish them well.`

    await notificationService.sendNotification({
      user_id: userId,
      title,
      body: message,
      notification_type: 'birthday',
      data: {
        birthday_user_id: birthdayUser.id,
        birthday_username: birthdayUser.username,
        birthday_full_name: birthdayUser.full_name,
        when,
        url: `/user/${birthdayUser.username}`
      }
    })
  } catch (error) {
    console.error('Error creating birthday notification:', error)
  }
}

/**
 * Get today's birthdays for display in sidebar
 */
export const getTodaysBirthdays = async (connectedUserIds: string[]) => {
  try {
    if (connectedUserIds.length === 0) return []

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url, birthday')
      .in('id', connectedUserIds)
      .not('birthday', 'is', null)

    if (error) {
      console.error('Error fetching birthdays:', error)
      return []
    }

    const today = new Date()
    const todayKey = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const todayBirthdays = profiles?.filter((profile) => {
      if (!profile.birthday) return false
      const parts = String(profile.birthday).split('-')
      if (parts.length < 3) return false
      const month = parts[1] || ''
      const day = parts[2] || ''
      return `${month.padStart(2, '0')}-${day.padStart(2, '0')}` === todayKey
    }) || []

    return todayBirthdays
  } catch (error) {
    console.error('Error getting today\'s birthdays:', error)
    return []
  }
}
