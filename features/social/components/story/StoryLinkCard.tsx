'use client'

import React from 'react'
import { Link2 } from '@/shared/icons'
import type { LinkPreviewData } from './storyLinkUtils'
import { inferLinkLabel } from './storyLinkUtils'

interface StoryLinkCardProps {
  url: string
  domain: string
  fallbackTitle?: string
  fallbackAuthor?: string
  fallbackImage?: string
  preview?: LinkPreviewData | null
  loading?: boolean
  onOpen: () => void
}

const StoryLinkCard: React.FC<StoryLinkCardProps> = ({
  url,
  domain,
  fallbackTitle = '',
  fallbackAuthor = '',
  fallbackImage = '',
  preview,
  loading = false,
  onOpen,
}) => {
  const title =
    preview?.title?.trim() ||
    fallbackTitle.trim() ||
    domain
  const author =
    preview?.siteName?.trim() ||
    fallbackAuthor.trim() ||
    ''
  const image = preview?.image || fallbackImage || ''
  const label = inferLinkLabel(url, preview?.type)
  const meta = [author, domain].filter(Boolean).join(' · ')

  return (
    <div className="relative z-20 flex w-full max-w-[min(420px,92vw)] flex-col items-center gap-4 px-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
        className="w-full overflow-hidden rounded-[28px] text-left shadow-2xl ring-1 ring-black/20 transition active:scale-[0.99]"
      >
        <div className="relative flex aspect-[4/3] min-h-[220px] items-center justify-center bg-[#2a2a2a] sm:min-h-[260px]">
          {loading && !image ? (
            <div className="h-24 w-24 animate-pulse rounded-full bg-white/10 sm:h-28 sm:w-28" />
          ) : image ? (
            <div className="h-28 w-28 overflow-hidden rounded-full ring-2 ring-white/15 shadow-lg sm:h-32 sm:w-32">
              <img src={image} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-3xl font-semibold text-white/80 sm:h-28 sm:w-28">
              {domain.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="bg-[#5c4638] px-5 pb-5 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
            {label}
          </p>
          <p className="mt-1.5 line-clamp-3 text-[20px] font-bold leading-snug text-white sm:text-[22px]">
            {loading && !preview?.title && !fallbackTitle ? 'Loading…' : title}
          </p>
          {meta ? (
            <p className="mt-2 truncate text-[13px] text-white/55">{meta}</p>
          ) : null}
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
        className="inline-flex items-center gap-2 rounded-full bg-black/55 px-5 py-2.5 text-[14px] font-medium text-white shadow-lg backdrop-blur-md transition hover:bg-black/70 active:scale-[0.98]"
      >
        <Link2 className="h-4 w-4 shrink-0 opacity-90" />
        <span className="max-w-[220px] truncate">{domain}</span>
      </button>
    </div>
  )
}

export default StoryLinkCard
