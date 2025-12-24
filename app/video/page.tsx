'use client'

import React from 'react'
import { ArrowLeft, Home, Video as VideoIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Footer from '@/shared/components/layout/FooterNext'

const VideoPage: React.FC = () => {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto px-4">
      {/* Header */}
      <div className=" border-b border-gray-200">
        <div className="py-6">
          {/* Back to Feed Button */}
          <button
            onClick={() => router.push('/feed')}
            className="flex items-center space-x-2 text-orange-600 hover:text-orange-700 transition-colors mb-4 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <Home className="w-4 h-4" />
            <span className="font-medium">Back to Feed</span>
          </button>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                <VideoIcon className="w-7 h-7 text-primary-600" />
                <span>Video</span>
              </h1>
              <p className="text-gray-600 mt-1">
                Watch and share videos from the African community
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className=" py-8">
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <VideoIcon className="w-10 h-10 text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Video Section Coming Soon!</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            We're working on bringing you an amazing video watching experience. In the meantime, check out Reels!
          </p>
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={() => router.push('/feed')}
              className="btn-primary px-6 py-3"
            >
              Watch Feed Instead
            </button>
            <button
              onClick={() => router.push('/feed')}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Back to Feed
            </button>
          </div>
        </div>

        {/* Feature Preview */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎬</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Long-form Videos</h3>
            <p className="text-sm text-gray-600">
              Watch documentaries, interviews, and educational content
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎓</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Educational Series</h3>
            <p className="text-sm text-gray-600">
              Learn about African culture, politics, and development
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎭</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Entertainment</h3>
            <p className="text-sm text-gray-600">
              Enjoy music videos, comedy, and creative performances
            </p>
          </div>
        </div>
      </div>
</div>
      {/* Footer */}
      <Footer />
    </div>
  )
}

export default VideoPage

