'use client'

import React from 'react'
import { Globe, Lock, Tag } from 'lucide-react'
import { REEL_ASPECT_RATIOS, REEL_CATEGORIES, ReelCategory } from '@/shared/types/reels'

interface ReviewStepProps {
  title: string
  description: string
  thumbnailUrl: string
  videoFile: File
  videoDuration: number
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:3'
  category: ReelCategory
  tags: string[]
  isPublic: boolean
  formatTime: (seconds: number) => string
  formatFileSize: (bytes: number) => string
}

export function ReviewStep({
  title,
  description,
  thumbnailUrl,
  videoFile,
  videoDuration,
  aspectRatio,
  category,
  tags,
  isPublic,
  formatTime,
  formatFileSize,
}: ReviewStepProps) {
  const categoryLabel = REEL_CATEGORIES.find((c) => c.value === category)?.label ?? category
  const ratioLabel = REEL_ASPECT_RATIOS.find((r) => r.value === aspectRatio)?.label ?? aspectRatio

  return (
    <section
      aria-labelledby="review-heading"
      className="rounded-2xl border border-border bg-surface p-4 sm:p-5"
    >
      <h2 id="review-heading" className="text-base font-semibold text-content">
        Review your memory
      </h2>
      <p className="mt-0.5 text-sm text-content-secondary">
        When you&apos;re happy with everything, tap Publish below
      </p>

      <div className="mt-4 flex gap-4">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="h-24 w-16 shrink-0 rounded-xl object-cover ring-1 ring-border sm:h-28 sm:w-[4.5rem]"
          />
        ) : (
          <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-xl bg-surface-secondary sm:h-28 sm:w-[4.5rem]">
            <span className="text-xs text-content-tertiary">No thumb</span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold text-content sm:text-base">{title}</h3>
          {description ? (
            <p className="mt-1 line-clamp-3 text-sm text-content-secondary">{description}</p>
          ) : (
            <p className="mt-1 text-sm italic text-content-tertiary">No description</p>
          )}
        </div>
      </div>

      <dl className="mt-4 space-y-2 rounded-xl bg-surface-canvas p-3 text-sm sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-content-secondary">Audience</dt>
          <dd className="flex items-center gap-1.5 font-medium text-content">
            {isPublic ? (
              <>
                <Globe className="h-3.5 w-3.5" aria-hidden />
                Public
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" aria-hidden />
                Private
              </>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-content-secondary">Category</dt>
          <dd className="font-medium text-content">{categoryLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-content-secondary">Aspect ratio</dt>
          <dd className="font-medium text-content">{ratioLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-content-secondary">Duration</dt>
          <dd className="font-medium text-content">{formatTime(videoDuration)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-content-secondary">File size</dt>
          <dd className="font-medium text-content">{formatFileSize(videoFile.size)}</dd>
        </div>
      </dl>

      {tags.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-medium text-content-secondary">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2.5 py-1 text-xs text-content"
              >
                <Tag className="h-3 w-3 text-content-secondary" aria-hidden />
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
