'use client'

import React from 'react'
import { MapPin } from 'lucide-react'
import {
  getPostLocationCategoryLabel,
  getPostLocationMapsUrl,
  getPostLocationStaticMapUrl,
  type PostLocationData,
} from '@/features/social/utils/postLocation'

interface PostLocationCheckInProps {
  location: PostLocationData
  onMapsClick?: (e: React.MouseEvent) => void
}

export const PostLocationCheckIn: React.FC<PostLocationCheckInProps> = ({
  location,
  onMapsClick,
}) => {
  const mapsUrl = getPostLocationMapsUrl(location)
  const staticMapUrl = getPostLocationStaticMapUrl(location)
  const categoryLabel = getPostLocationCategoryLabel(location)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onMapsClick?.(e)
  }

  return (
    <div className="-mx-3 sm:-mx-4 mb-2">
      {staticMapUrl ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="block relative overflow-hidden bg-gray-100"
          title="Open in Google Maps"
        >
          <img
            src={staticMapUrl}
            alt={`Map showing ${location.display_name}`}
            className="w-full h-[200px] sm:h-[240px] object-cover"
            loading="lazy"
          />
        </a>
      ) : (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="flex h-[200px] sm:h-[240px] items-center justify-center bg-gray-100 text-gray-500"
          title="Open in Google Maps"
        >
          <MapPin className="h-10 w-10 text-red-500" aria-hidden />
        </a>
      )}

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="flex items-center gap-3 px-3 sm:px-4 py-3 border-t border-gray-100 hover:bg-gray-50 transition-colors"
        title="Open in Google Maps"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100">
          <MapPin className="h-6 w-6 text-gray-500" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          {categoryLabel ? (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 truncate">
              {categoryLabel}
            </p>
          ) : null}
          <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">
            {location.display_name}
          </p>
        </div>
      </a>
    </div>
  )
}
