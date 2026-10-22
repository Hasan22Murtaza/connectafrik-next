'use client'

import Link from 'next/link'
import { Heart, Play, Video } from '@/shared/icons'
import { Reel } from '@/shared/types/reels'

function formatShortCount(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(num)
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

const TILE_ASPECTS = [
  'aspect-[9/16]',
  'aspect-[4/5]',
  'aspect-square',
  'aspect-[3/4]',
  'aspect-[9/14]',
  'aspect-[5/6]',
] as const

type Props = {
  reel: Reel
  index?: number
  href?: string
  onClick?: () => void
  className?: string
}

export function ReelCard({ reel, index = 0, href, onClick, className = '' }: Props) {
  const aspect = TILE_ASPECTS[index % TILE_ASPECTS.length]

  const inner = (
    <>
      {reel.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote CDN thumbs
        <img
          src={reel.thumbnail_url}
          alt=""
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-neutral-800 to-neutral-950 text-white/35">
          <Video className="h-10 w-10" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[11px] font-semibold text-white drop-shadow-sm sm:text-xs">
        <Play className="h-3 w-3 fill-white" strokeWidth={0} aria-hidden />
        <span className="tabular-nums">{formatDuration(reel.duration)}</span>
      </div>
      <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[11px] font-semibold text-white drop-shadow-sm sm:text-xs">
        <Heart className="h-3 w-3" strokeWidth={2} aria-hidden />
        <span className="tabular-nums">{formatShortCount(reel.likes_count)}</span>
      </div>
    </>
  )

  const baseClass = `group relative ${aspect} w-full overflow-hidden rounded-2xl bg-neutral-900 text-left shadow-sm ring-1 ring-white/5 transition hover:ring-[color-mix(in_srgb,var(--african-orange)_55%,transparent)] ${className}`

  if (href) {
    return (
      <Link href={href} scroll={false} className={baseClass}>
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
