'use client'

import React, { useState } from 'react'
import { Images, Video, X, Download } from 'lucide-react'
import { GroupPost } from '@/shared/hooks/useGroupPosts'
import { formatDistanceToNow } from 'date-fns'

interface GroupMediaGalleryProps {
  posts: GroupPost[]
  loading: boolean
}

const GroupMediaGallery: React.FC<GroupMediaGalleryProps> = ({ posts, loading }) => {
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: 'image' | 'video'; post: GroupPost } | null>(null)

  // Extract all media from posts
  const allMedia = posts
    .filter(post => post.media_urls && post.media_urls.length > 0)
    .flatMap(post => 
      (post.media_urls || []).map(url => ({
        url,
        type: url.match(/\.(mp4|webm|mov|avi)$/i) ? 'video' as const : 'image' as const,
        post
      }))
    )

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (allMedia.length === 0) {
    return (
      <div className="text-center py-12">
        <Images className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No media yet</h3>
        <p className="text-gray-500">
          Photos and videos shared in group posts will appear here
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {allMedia.length} {allMedia.length === 1 ? 'item' : 'items'}
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {allMedia.map((media, index) => (
          <div
            key={`${media.post.id}-${index}`}
            className="relative group cursor-pointer aspect-square"
            onClick={() => setSelectedMedia(media)}
          >
            {media.type === 'image' ? (
              <img
                src={media.url}
                alt={`Media from ${media.post.title}`}
                className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
              />
            ) : (
              <div className="w-full h-full bg-gray-900 rounded-lg flex items-center justify-center relative">
                <video
                  src={media.url}
                  className="w-full h-full object-cover rounded-lg"
                  muted
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Video className="w-12 h-12 text-white opacity-80" />
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
              {media.type === 'image' ? (
                <Images className="w-6 h-6 text-white" />
              ) : (
                <Video className="w-6 h-6 text-white" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Media Viewer Modal */}
      {selectedMedia && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMedia(null)}
        >
          <div className="relative max-w-7xl w-full h-full flex items-center justify-center">
            <button
              onClick={() => setSelectedMedia(null)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>

            {selectedMedia.type === 'image' ? (
              <img
                src={selectedMedia.url}
                alt="Full size media"
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <video
                src={selectedMedia.url}
                controls
                autoPlay
                className="max-w-full max-h-full"
                onClick={(e) => e.stopPropagation()}
              />
            )}

            {/* Media Info */}
            <div className="absolute bottom-4 left-4 right-4 bg-black/60 text-white p-4 rounded-lg">
              <p className="font-semibold">{selectedMedia.post.title}</p>
              <p className="text-sm text-gray-300 mt-1">
                {formatDistanceToNow(new Date(selectedMedia.post.created_at), { addSuffix: true })}
              </p>
              <a
                href={selectedMedia.url}
                download
                className="inline-flex items-center gap-2 mt-2 text-sm text-blue-400 hover:text-blue-300"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default GroupMediaGallery

