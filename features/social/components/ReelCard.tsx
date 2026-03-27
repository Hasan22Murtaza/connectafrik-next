'use client'

import Link from 'next/link'
import { Heart, Video } from 'lucide-react'
import { Reel } from '@/shared/types/reels'

function formatShortCount(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return String(num)
}

type Props = {
  reel: Reel
  /** If set, card renders as a link (e.g. explore → feed). */
  href?: string
  onClick?: () => void
  className?: string
}

export function ReelCard({ reel, href, onClick, className = '' }: Props) {
  const inner = (
    <>
      {reel.thumbnail_url ? (
        <img
          src={reel.thumbnail_url}
          alt=""
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-gray-800 to-gray-900 text-white/40">
          <Video className="h-10 w-10" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <div className="absolute bottom-2 left-2 right-2 space-y-0.5">
        <div className="flex items-center gap-1 text-xs font-semibold text-white">
          <Heart className="h-3.5 w-3.5 text-white" fill="currentColor" strokeWidth={0} />
          {formatShortCount(reel.likes_count)}
        </div>
        <div className="truncate text-xs font-medium text-white drop-shadow">@{reel.profiles?.username ?? 'user'}</div>
      </div>
    </>
  )

  const baseClass = `group relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-gray-200 text-left shadow-sm ring-1 ring-black/5 transition hover:ring-primary-500/40 ${className}`

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {inner}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={baseClass}>
      {inner}
    </button>
  )
}
