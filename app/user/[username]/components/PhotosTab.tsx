'use client'

import React, { useState } from 'react'
import { Camera } from 'lucide-react'
import ImageViewer from '@/shared/components/ui/ImageViewer'

const EmptyState = ({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) => (
  <div className="text-center py-14">
    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
      <Icon className="w-8 h-8 text-gray-400" />
    </div>
    <p className="text-gray-700 font-medium">{title}</p>
    <p className="text-sm text-gray-500 mt-1">{sub}</p>
  </div>
)

interface PhotoItem {
  url: string
  postId: string
}

interface PhotosTabProps {
  photos: PhotoItem[]
  isOwnProfile: boolean
}

const PhotosTab: React.FC<PhotosTabProps> = ({ photos, isOwnProfile }) => {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  return (
    <>
      <div className="bg-white sm:rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Photos</h2>
        </div>
        <div className="p-2 sm:p-4">
          {photos.length === 0 ? (
            <EmptyState
              icon={Camera}
              title="No photos yet"
              sub={isOwnProfile ? 'Photos from your posts will appear here.' : 'No photos to show.'}
            />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-0.5 sm:gap-2">
              {photos.map((p, i) => (
                <div
                  key={`ph-${p.postId}-${i}`}
                  className="aspect-square sm:rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:brightness-90 transition"
                  onClick={() => setPreviewIndex(i)}
                >
                  <img src={p.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ImageViewer
        images={photos.map((p) => p.url)}
        initialIndex={previewIndex ?? 0}
        isOpen={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
      />
    </>
  )
}

export default PhotosTab
