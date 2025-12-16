import React, { useEffect, useMemo, useState } from 'react'
import LeftSidebar from '@/shared/components/ui/LeftSidebar'
import RightSidebar from '@/shared/components/ui/RightSidebar'
import MobileMenuButton from '@/shared/components/ui/MobileMenuButton'
import { useProductionChat } from '@/contexts/ProductionChatContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { checkUpcomingBirthdays } from '@/shared/services/birthdayNotificationService'
import { friendRequestService } from '@/features/social/services/friendRequestService'

const placeholderAds = [
  { id: 'ad1', title: 'Build your own AI Agent!', url: 'https://getodin.ai', image: '/assets/images/odin.png' },
  { id: 'ad2', title: 'Ghana Identification Authority', url: 'https://nia.gov.gh/', image: '/assets/images/ghanania.png' },
]

const FeedLayout = ({ children }) => {
  const { presence, updatePresence } = useProductionChat()
  const { user } = useAuth()
  const [friends, setFriends] = useState([])
  const [suggestedUsers, setSuggestedUsers] = useState([])
  const [birthdays, setBirthdays] = useState([])
  const [ads] = useState(placeholderAds)

  useEffect(() => {
    let isMounted = true

    const loadSidebarData = async () => {
      try {
        // Load friends (accepted friend requests)
        const friendsList = await friendRequestService.getFriends()

        // Load suggested users (people you may know)
        const suggested = await friendRequestService.getSuggestedUsers(20)

        if (!isMounted) return

        // Update presence for all friends
        friendsList.forEach((friend) => {
          const fallbackStatus = friend.status || (friend.last_seen ? 'away' : 'offline')
          updatePresence(friend.id, fallbackStatus)
        })

        setFriends(friendsList)
        setSuggestedUsers(suggested)

        // Get birthdays from friends only
        const today = new Date()
        const todayKey = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

        // Fetch birthday data for friends
        const { data: friendProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, birthday')
          .in('id', friendsList.map(f => f.id))

        const todaysBirthdays = (friendProfiles || [])
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
          setFriends([])
          setSuggestedUsers([])
          setBirthdays([])
        }
      }
    }

    loadSidebarData()

    return () => {
      isMounted = false
    }
  }, [updatePresence])

  // Check for upcoming birthdays and send notifications (daily check)
  useEffect(() => {
    if (!user?.id) return

    const checkBirthdays = async () => {
      try {
        await checkUpcomingBirthdays(user.id)
      } catch (error) {
        console.error('Error checking birthdays:', error)
      }
    }

    // Check on mount
    checkBirthdays()

    // Check daily (every 24 hours)
    const interval = setInterval(checkBirthdays, 24 * 60 * 60 * 1000)

    return () => clearInterval(interval)
  }, [user?.id])

  // Format friends for display (with presence status)
  const friendsWithPresence = useMemo(() => {
    return friends.map((friend) => {
      const status = presence[friend.id] || friend.status || (friend.last_seen ? 'away' : 'offline')
      return {
        id: friend.id,
        name: friend.full_name,
        full_name: friend.full_name,
        avatarUrl: friend.avatar_url,
        avatar_url: friend.avatar_url,
        status,
        lastSeen: friend.last_seen,
      }
    })
  }, [friends, presence])

  // Online friends only (for left sidebar)
  const onlineFriends = useMemo(
    () => friendsWithPresence.filter((contact) => contact.status !== 'offline'),
    [friendsWithPresence]
  )

  // All friends list (for right sidebar contacts section)
  const friendsList = useMemo(
    () =>
      friendsWithPresence.map((contact) => ({
        id: contact.id,
        full_name: contact.full_name,
        avatar_url: contact.avatar_url,
        status: contact.status, // Include status for online indicator
      })),
    [friendsWithPresence]
  )

  // Suggested users formatted for display (People You May Know)
  const suggestedContactsFormatted = useMemo(() => {
    return suggestedUsers.map((user) => ({
      id: user.id,
      name: user.full_name,
      full_name: user.full_name,
      avatarUrl: user.avatar_url,
      avatar_url: user.avatar_url,
      status: user.status || 'offline',
      lastSeen: user.last_seen,
    }))
  }, [suggestedUsers])

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Left Sidebar - Hidden on mobile, visible on desktop */}
      <div className="hidden lg:block overflow-y-auto sticky top-[73px] h-[93vh]">
        <LeftSidebar onlineContacts={onlineFriends} />
      </div>

      {/* Main Content - Full width on mobile, centered on desktop */}
      <main className="flex-1 lg:max-w-2xl lg:mx-auto py-2 sm:py-4 lg:py-8 px-1 sm:px-2 lg:px-4">
        {children}
      </main>

      {/* Right Sidebar - Hidden on mobile, visible on desktop */}
      <div className="hidden lg:block overflow-y-auto sticky top-[73px] h-[93vh]">
        <RightSidebar
          birthdays={birthdays}
          contacts={friendsList}
          ads={ads}
          onlineContacts={suggestedContactsFormatted}
        />
      </div>

      {/* Mobile Menu Button - Floating button on mobile only */}
      <MobileMenuButton />
    </div>
  )
}

export default FeedLayout
