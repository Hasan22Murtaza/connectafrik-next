'use client'

import React, { useState } from 'react'
import { Camera, X } from '@/shared/icons'
import type { CapturedReelMedia } from './reelMediaUtils'
import type { ReelEditState } from './ReelMediaEditor'

type Props = {
  media: CapturedReelMedia
  edit: ReelEditState
  caption: string
  onCaptionChange: (value: string) => void
  onPublicChange: (value: boolean) => void
  onClose: () => void
  onOpenCamera: () => void
  onChangeMedia: () => void
  onEditMedia: () => void
  onShare: () => void
  isSharing: boolean
}

const MAX_CAPTION = 200

function GalleryGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 16.5 8 12l3.5 3.5L15 12l5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16.5" cy="9" r="1.35" fill="currentColor" />
    </svg>
  )
}

export default function ReelCaptionShare({
  media,
  edit,
  caption,
  onCaptionChange,
  onPublicChange,
  onClose,
  onOpenCamera,
  onChangeMedia,
  onEditMedia,
  onShare,
  isSharing,
}: Props) {
  const [showPrivacy, setShowPrivacy] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
        <header
          className="relative flex h-12 shrink-0 items-center justify-center px-3"
          style={{ marginTop: 'env(safe-area-inset-top)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          <h1 className="text-[17px] font-semibold">New reel</h1>
          <button
            type="button"
            onClick={onOpenCamera}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5"
            aria-label="Open camera"
          >
            <Camera className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
          <div className="mb-4 h-[112px] w-[112px] overflow-hidden rounded-[10px] bg-[#1C1C1E]">
            {media.thumbnailUrl ? (
              <img src={media.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <video src={media.preview} className="h-full w-full object-cover" muted playsInline />
            )}
          </div>

          <div className="relative mb-1">
            <textarea
              value={caption}
              onChange={(e) => onCaptionChange(e.target.value.slice(0, MAX_CAPTION))}
              placeholder="Write a caption..."
              rows={5}
              className="w-full resize-y rounded-[12px] border-0 bg-[#3A3B3C] px-4 py-3.5 text-[15px] leading-snug text-white outline-none placeholder:text-[#B0B3B8]"
            />
            <span
              className="pointer-events-none absolute bottom-2.5 right-2.5 h-3 w-3 opacity-40"
              aria-hidden
              style={{
                background:
                  'linear-gradient(135deg, transparent 50%, #B0B3B8 50%)',
              }}
            />
          </div>

          <div className="mt-1">
            <button
              type="button"
              onClick={() => setShowPrivacy((v) => !v)}
              className="flex w-full items-center border-b border-[#3A3B3C] py-[15px] text-left text-[15px]"
            >
              Edit media &amp; privacy
            </button>
            {showPrivacy && (
              <div className="space-y-2 border-b border-[#3A3B3C] py-3">
                <button
                  type="button"
                  onClick={onEditMedia}
                  className="w-full rounded-xl bg-[#1C1C1E] px-3 py-2.5 text-left text-[14px]"
                >
                  Back to editor
                </button>
                <label className="flex items-center justify-between rounded-xl bg-[#1C1C1E] px-3 py-2.5 text-[14px]">
                  <span>{edit.isPublic ? 'Public' : 'Only me'}</span>
                  <input
                    type="checkbox"
                    checked={edit.isPublic}
                    onChange={(e) => onPublicChange(e.target.checked)}
                    className="h-4 w-4 accent-[var(--african-orange)]"
                  />
                </label>
              </div>
            )}

            <button
              type="button"
              onClick={onChangeMedia}
              className="flex w-full items-center gap-3 py-[15px] text-left text-[15px]"
            >
              <GalleryGlyph className="h-5 w-5 text-white" />
              <span>Change photos or videos</span>
            </button>
          </div>
        </div>

        <div
          className="shrink-0 px-4 pt-2"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={onShare}
            disabled={isSharing || !caption.trim()}
            className="flex w-full items-center justify-center rounded-[10px] bg-[var(--african-orange)] py-[14px] text-[16px] font-bold text-white disabled:opacity-50"
          >
            {isSharing ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Sharing…
              </span>
            ) : (
              'Share reel'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
