import React, { useState } from 'react'
import { Play, Pause, Volume2, VolumeX, Download, ExternalLink } from 'lucide-react'

interface MediaDisplayProps {
  mediaUrls: string[]
  className?: string
}

const MediaDisplay: React.FC<MediaDisplayProps> = ({ mediaUrls, className = '' }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  if (!mediaUrls || mediaUrls.length === 0) return null

  const getMediaType = (url: string): 'image' | 'video' | 'audio' | 'unknown' => {
    if (url.includes('post-images') || /\.(jpg|jpeg|png|gif|webp)$/i.test(url)) return 'image'
    if (url.includes('post-videos') || /\.(mp4|webm|mov|avi)$/i.test(url)) return 'video'
    if (url.includes('post-audio') || /\.(mp3|wav|ogg|m4a)$/i.test(url)) return 'audio'
    return 'unknown'
  }

  const handleVideoToggle = async (videoElement: HTMLVideoElement) => {
    try {
      if (isVideoPlaying) {
        videoElement.pause()
        setIsVideoPlaying(false)
      } else {
        await videoElement.play()
        setIsVideoPlaying(true)
      }
    } catch (error) {
      console.error('Video play/pause error:', error)
      // Don't update state if play failed
    }
  }

  const handleAudioToggle = async (audioElement: HTMLAudioElement) => {
    try {
      if (isAudioPlaying) {
        audioElement.pause()
        setIsAudioPlaying(false)
      } else {
        await audioElement.play()
        setIsAudioPlaying(true)
      }
    } catch (error) {
      console.error('Audio play/pause error:', error)
      // Don't update state if play failed
    }
  }

  const toggleMute = (mediaElement: HTMLVideoElement | HTMLAudioElement) => {
    mediaElement.muted = !mediaElement.muted
    setIsMuted(mediaElement.muted)
  }

  const currentUrl = mediaUrls[currentIndex]
  const mediaType = getMediaType(currentUrl)

  return (
    <div className={`relative ${className}`}>
      {/* Main Media Display */}
      <div className="relative bg-gray-100 rounded-lg overflow-hidden">
        {mediaType === 'image' && (
          <img
            src={currentUrl}
            alt="Post media"
            className="w-full h-auto max-h-96 object-contain"
            loading="lazy"
          />
        )}

        {mediaType === 'video' && (
          <div className="relative">
            <video
              src={currentUrl}
              className="w-full h-auto max-h-96 object-contain"
              muted={isMuted}
              onPlay={() => setIsVideoPlaying(true)}
              onPause={() => setIsVideoPlaying(false)}
              onEnded={() => setIsVideoPlaying(false)}
              controls={false}
            />
            {/* Video Controls Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={async (e) => {
                  const video = e.currentTarget.parentElement?.parentElement?.querySelector('video') as HTMLVideoElement
                  if (video) await handleVideoToggle(video)
                }}
                className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-opacity-70 transition-all duration-200"
              >
                {isVideoPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </button>
            </div>
            {/* Volume Control */}
            <div className="absolute top-4 right-4">
              <button
                onClick={(e) => {
                  const video = e.currentTarget.parentElement?.parentElement?.querySelector('video') as HTMLVideoElement
                  if (video) toggleMute(video)
                }}
                className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-opacity-70"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {mediaType === 'audio' && (
          <div className="p-6 flex items-center space-x-4 bg-gradient-to-r from-blue-50 to-purple-50">
            <button
              onClick={async (e) => {
                const audio = e.currentTarget.parentElement?.querySelector('audio') as HTMLAudioElement
                if (audio) await handleAudioToggle(audio)
              }}
              className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white hover:bg-blue-600 transition-colors duration-200"
            >
              {isAudioPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
            </button>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Audio File</div>
              <div className="text-xs text-gray-500">Click to play</div>
            </div>
            <audio
              src={currentUrl}
              onPlay={() => setIsAudioPlaying(true)}
              onPause={() => setIsAudioPlaying(false)}
              onEnded={() => setIsAudioPlaying(false)}
              className="hidden"
            />
            <button
              onClick={() => window.open(currentUrl, '_blank')}
              className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-300"
              title="Download audio"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        )}

        {mediaType === 'unknown' && (
          <div className="p-6 text-center">
            <div className="text-gray-500 mb-2">Unknown media type</div>
            <button
              onClick={() => window.open(currentUrl, '_blank')}
              className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in new tab</span>
            </button>
          </div>
        )}
      </div>

      {/* Multiple Media Navigation */}
      {mediaUrls.length > 1 && (
        <div className="mt-3">
          {/* Thumbnails */}
          <div className="flex space-x-2 overflow-x-auto">
            {mediaUrls.map((url, index) => {
              const type = getMediaType(url)
              return (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                    index === currentIndex
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {type === 'image' ? (
                    <img
                      src={url}
                      alt={`Media ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : type === 'video' ? (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white" />
                    </div>
                  ) : type === 'audio' ? (
                    <div className="w-full h-full bg-blue-100 flex items-center justify-center">
                      <Volume2 className="w-6 h-6 text-blue-600" />
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <ExternalLink className="w-4 h-4 text-gray-600" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Counter */}
          <div className="text-center mt-2">
            <span className="text-xs text-gray-500">
              {currentIndex + 1} of {mediaUrls.length}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default MediaDisplay