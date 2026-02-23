import { apiClient } from '@/lib/api-client'
import { notificationService } from '@/shared/services/notificationService'

interface BirthdayUser {
  id: string
  full_name: string
  username: string
  birthday: string
}

export const checkUpcomingBirthdays = async (currentUserId: string) => {
  try {
    const res = await apiClient.get<{ data: any[] }>('/api/friends/birthdays')
    const profiles = res.data || []

    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayKey = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const tomorrowKey = `${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

    const todayBirthdays: BirthdayUser[] = []
    const tomorrowBirthdays: BirthdayUser[] = []

    profiles.forEach((profile: any) => {
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

    for (const user of todayBirthdays) {
      await createBirthdayNotification(currentUserId, user, 'today')
    }

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

const createBirthdayNotification = async (
  userId: string,
  birthdayUser: BirthdayUser,
  when: 'today' | 'tomorrow'
) => {
  try {
    const title = when === 'today'
      ? `${birthdayUser.full_name}'s Birthday!`
      : `Upcoming Birthday`

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

export const getTodaysBirthdays = async (connectedUserIds: string[]) => {
  try {
    if (connectedUserIds.length === 0) return []

    const res = await apiClient.get<{ data: any[] }>('/api/friends/birthdays')
    const profiles = res.data || []

    const today = new Date()
    const todayKey = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const todayBirthdays = profiles.filter((profile: any) => {
      if (!profile.birthday) return false
      const parts = String(profile.birthday).split('-')
      if (parts.length < 3) return false
      const month = parts[1] || ''
      const day = parts[2] || ''
      return `${month.padStart(2, '0')}-${day.padStart(2, '0')}` === todayKey
    })

    return todayBirthdays
  } catch (error) {
    console.error('Error getting today\'s birthdays:', error)
    return []
  }
}
