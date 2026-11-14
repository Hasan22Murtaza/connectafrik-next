import React, { useEffect, useState } from 'react'
import RightSidebar from '@/shared/components/ui/RightSidebar'
import { useAuth } from '@/contexts/AuthContext'
import { checkUpcomingBirthdays } from '@/shared/services/birthdayNotificationService'
import { friendRequestService } from '@/features/social/services/friendRequestService'

const placeholderAds = [
  { id: 'ad1', title: 'Build your own AI Agent!', url: 'https://getodin.ai', image: '/assets/images/odin.png' },
  { id: 'ad2', title: 'Grow your community', url: 'https://cribstalk.com', image: '/assets/images/odin.png' },
]

const FeedLayout = ({ children }) => {
  const { user } = useAuth()
  const [birthdays, setBirthdays] = useState([])
  const [ads] = useState(placeholderAds)

  useEffect(() => {
    let isMounted = true

    const loadSidebarData = async () => {
      try {
        // Friends only — suggestions are fetched by PeopleYouMayKnow on the feed.
        const friendsList = await friendRequestService.getFriends()

        if (!isMounted) return

        // Get birthdays from friends only (no extra profile query)
        const today = new Date()
        const todayKey = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

        const todaysBirthdays = (friendsList || [])
          .filter((profile) => {
            if (!profile.birthday) return false
            const parts = String(profile.birthday).split('-')
            if (parts.length < 3) return false
            const month = parts[1] || ''
            const day = parts[2] || ''
            return `${month.padStart(2, '0')}-${day.padStart(2, '0')}` === todayKey
          })
          .map((profile) => ({
            id: profile.id,
            full_name: profile.full_name || 'Friend',
          }))

        setBirthdays(todaysBirthdays)
      } catch (error) {
        console.error('Failed to load sidebar data:', error)
        if (isMounted) {
          setBirthdays([])
        }
      }
    }

    loadSidebarData()

    return () => {
      isMounted = false
    }
  }, [])

  // Check for upcoming birthdays and send notifications (dedup handled in service)
  useEffect(() => {
    if (!user?.id) return

    let didRun = false

    const checkBirthdays = async () => {
      // Guard against React strict-mode double-mount
      if (didRun) return
      didRun = true
      try {
        await checkUpcomingBirthdays(user.id)
      } catch (error) {
        console.error('Birthday notification check failed:', error)
      }
    }

    void checkBirthdays()
  }, [user?.id])

  return (
    <div className="flex min-h-screen px-1 sm:px-2 2xl:px-6 ">
      {/* Main Content — global LeftSidebar is provided by ConditionalAppSidebar */}
      <main className="flex-1 md:max-w-lg lg:max-w-3xl overflow-x-auto lg:mx-auto py-2 sm:py-4  px-2 sm:px-2 lg:px-4">
        {children}
      </main>

      {/* Right Sidebar - Hidden on mobile, visible on desktop */}
      <div className="hidden lg:block overflow-y-auto sticky top-[73px] h-[calc(100vh-73px)] ">
        <RightSidebar
          birthdays={birthdays}
          ads={ads}
        />
      </div>

    </div>
  )}

export default FeedLayout
