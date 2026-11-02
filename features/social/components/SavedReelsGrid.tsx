'use client'

import React from 'react'
import { Reel } from '@/shared/types/reels'
import { ReelCard } from './ReelCard'
import { reelsFeedHref } from '@/lib/reels/feedHref'

type Props = {
  reels: Reel[]
  onReelDeleted?: (reelId: string) => void
}

export const SavedReelsGrid: React.FC<Props> = ({ reels }) => {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5 xl:grid-cols-6">
      {reels.map((reel) => (
        <ReelCard
          key={reel.id}
          reel={reel}
          href={reelsFeedHref({ start: reel.id, feed: 'saved' })}
        />
      ))}
    </div>
  )
}

export default SavedReelsGrid
