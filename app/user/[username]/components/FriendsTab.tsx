'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Users } from '@/shared/icons'
import type { Friend, MutualFriend } from '@/shared/types'

const EmptyState = ({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) => (
  <div className="text-center py-14">
    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
      <Icon className="w-8 h-8 text-gray-400" />
    </div>
    <p className="text-gray-700 font-medium">{title}</p>
    <p className="text-sm text-gray-500 mt-1">{sub}</p>
  </div>
)

interface FriendsTabProps {
  friends: Friend[]
  mutualFriends: MutualFriend[]
  isOwnProfile: boolean
}

const FriendsTab: React.FC<FriendsTabProps> = ({ friends, mutualFriends, isOwnProfile }) => {
  const router = useRouter()
  const [view, setView] = React.useState<'friends' | 'mutual'>('friends')
// Convert mutual friends to Friend format
const mutualFriendRows = React.useMemo(
  () =>
    mutualFriends.map((friend) => ({
      id: friend.user_id,
      username: friend.username,
      full_name: friend.full_name,
      avatar_url: friend.avatar_url ?? undefined,
    })),
  [mutualFriends]
)

// Merge both arrays and remove duplicates
const allFriends = React.useMemo(() => {
  const uniqueFriends = new Map<string, Friend>()

  friends.forEach((friend) => {
    uniqueFriends.set(friend.id, friend)
  })

  mutualFriendRows.forEach((friend) => {
    if (!uniqueFriends.has(friend.id)) {
      uniqueFriends.set(friend.id, friend)
    }
  })

  return Array.from(uniqueFriends.values())
}, [friends, mutualFriendRows])

// Display respective arrays
const displayedFriends =
  view === 'friends' ? allFriends : mutualFriendRows
  
  const title = view === 'friends' ? 'Friends' : 'Mutual Friends'

  return (
    <div className="bg-white sm:rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-600">{title}</h2>
        {displayedFriends.length > 0 && (
          <span className="text-[13px] sm:text-sm text-gray-500">
            {displayedFriends.length} {displayedFriends.length === 1 ? 'friend' : 'friends'}
          </span>
        )}
      </div>
      {!isOwnProfile && (
        <div className="flex gap-2 border-b border-gray-200 px-4 pt-3 sm:px-6">
          {([
            { key: 'friends', label: 'Friends' },
            { key: 'mutual', label: 'Mutual Friends' },
          ] as const).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setView(option.key)}
              className={`border-b-2 px-2 pb-3 text-sm font-semibold transition-colors ${
                view === option.key
                  ? 'border-[#F97316] text-[#F97316]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      <div className="p-2 sm:p-4">
        {displayedFriends.length === 0 ? (
          <EmptyState
            icon={Users}
            title={view === 'friends' ? 'No friends yet' : 'No mutual friends'}
            sub={
              view === 'friends'
                ? isOwnProfile ? 'Your friends will appear here.' : 'This user has no friends to show.'
                : 'You do not have any mutual friends with this user.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-3">
            {displayedFriends.map((f) => (
              <button
                key={f.id}
                onClick={() => router.push(`/user/${f.id}`)}
                className="flex items-center gap-3 p-2.5 sm:p-3 rounded-lg hover:bg-gray-50 transition text-left"
              >
                <div className="w-[52px] h-[52px] sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {f.avatar_url ? (
                    <img src={f.avatar_url} alt={f.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                      <span className="text-lg font-semibold text-gray-500">
                        {f.full_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] sm:text-[15px] font-semibold text-gray-900 truncate">{f.full_name}</p>
                  <p className="text-[12px] sm:text-[13px] text-gray-500 truncate">@{f.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default FriendsTab
