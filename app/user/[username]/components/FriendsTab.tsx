'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'

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
  friends: any[]
  isOwnProfile: boolean
}

const FriendsTab: React.FC<FriendsTabProps> = ({ friends, isOwnProfile }) => {
  const router = useRouter()

  return (
    <div className="bg-white sm:rounded-lg shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">Friends</h2>
        {friends.length > 0 && (
          <span className="text-[13px] sm:text-sm text-gray-500">
            {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
          </span>
        )}
      </div>
      <div className="p-2 sm:p-4">
        {friends.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No friends yet"
            sub={isOwnProfile ? 'Your friends will appear here.' : 'This user has no friends to show.'}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-3">
            {friends.map((f: any) => (
              <button
                key={f.id}
                onClick={() => router.push(`/user/${f.username}`)}
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
