'use client'

import React from 'react'
import { MapPin, Calendar, Users, MessageSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { UserProfileWithVisibility } from '@/shared/types'
import type { VisibleProfileFields } from '@/shared/utils/visibilityUtils'

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

const AboutDetailRow = ({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) => (
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4 text-gray-500" />
    </div>
    <p className="text-[15px] text-gray-900">{children}</p>
  </div>
)

interface AboutTabProps {
  profile: UserProfileWithVisibility
  visibleFields: VisibleProfileFields
}

const AboutTab: React.FC<AboutTabProps> = ({ profile, visibleFields }) => {
  return (
    <div className="bg-white sm:rounded-lg shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">About</h2>
      </div>
      <div className="p-4 sm:p-6 space-y-5">
        {profile.bio && (
          <div className="pb-5 border-b border-gray-100">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Bio</h3>
            <p className="text-[14px] sm:text-[15px] text-gray-800 leading-relaxed">{profile.bio}</p>
          </div>
        )}
        <div className="space-y-3 sm:space-y-4">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide">Details</h3>
          {visibleFields.country && profile.country && (
            <AboutDetailRow icon={MapPin}>
              From <span className="font-semibold">{profile.country}</span>
            </AboutDetailRow>
          )}
          {visibleFields.location && (profile as UserProfileWithVisibility).location && (
            <AboutDetailRow icon={MapPin}>
              Lives in <span className="font-semibold">{(profile as UserProfileWithVisibility).location}</span>
            </AboutDetailRow>
          )}
          <AboutDetailRow icon={Calendar}>
            <span suppressHydrationWarning>
              Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
            </span>
          </AboutDetailRow>
          <AboutDetailRow icon={Users}>
            <span className="font-semibold">{fmt(profile.following_count)}</span> tapping in
          </AboutDetailRow>
          <AboutDetailRow icon={MessageSquare}>
            <span className="font-semibold">{profile.posts_count}</span> posts
          </AboutDetailRow>
        </div>
      </div>
    </div>
  )
}

export default AboutTab
