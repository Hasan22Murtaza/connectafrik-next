'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Film, X, ChevronLeft, ChevronRight,
  Play, Pause, Volume2, VolumeX,
} from 'lucide-react'

const EmptyState = ({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) => (
  <div className="text-center py-14">
    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
      <Icon className="w-8 h-8 text-gray-400" />
    </div>
    <p className="text-gray-700 font-medium">{title}</p>
    <p className="text-sm text-gray-500 mt-1">{sub}</p>
  </div>
)

interface VideoItem {
  url: string
  postId: string
  content: string
  author: { id: string; username: string; full_name: string; avatar_url: string | null; country: string | null }
}

interface ReelsTabProps {
  videos: VideoItem[]
  isOwnProfile: boolean
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const ReelPlayer: React.FC<{
  videos: VideoItem[]
  initialIndex: number
  onClose: () => void
}> = ({ videos, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const video = videos[currentIndex]

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.muted = isMuted
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false))
    }
  }, [currentIndex])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': onClose(); break
        case 'ArrowLeft': if (currentIndex > 0) setCurrentIndex((p) => p - 1); break
        case 'ArrowRight': if (currentIndex < videos.length - 1) setCurrentIndex((p) => p + 1); break
        case ' ':
          e.preventDefault()
          handlePlayPause()
          break
        case 'm': handleMuteToggle(); break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [currentIndex, videos.length])

  const handlePlayPause = useCallback(() => {
    const vid = videoRef.current
    if (!vid) return
    if (vid.paused) {
      vid.play().then(() => setIsPlaying(true)).catch(() => {})
    } else {
      vid.pause()
      setIsPlaying(false)
    }
  }, [])

  const handleMuteToggle = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted
      setIsMuted(videoRef.current.muted)
    }
  }, [])

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime)
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) setDuration(videoRef.current.duration)
  }, [])

  const handleVideoEnded = useCallback(() => {
    if (currentIndex < videos.length - 1) {
      setCurrentIndex((p) => p + 1)
    } else {
      setIsPlaying(false)
      if (videoRef.current) videoRef.current.currentTime = 0
    }
  }, [currentIndex, videos.length])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }, [])

  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false)
    }, 3000)
  }, [isPlaying])

  useEffect(() => {
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current) }
  }, [])

  const goNext = () => { if (currentIndex < videos.length - 1) setCurrentIndex((p) => p + 1) }
  const goPrev = () => { if (currentIndex > 0) setCurrentIndex((p) => p - 1) }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      <div
        className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="flex items-center gap-3">
          {video.author.avatar_url ? (
            <img src={video.author.avatar_url} alt={video.author.full_name} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">{video.author.full_name.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div>
            <p className="text-white text-sm font-semibold">{video.author.full_name}</p>
            <p className="text-white/60 text-xs">@{video.author.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {videos.length > 1 && (
            <span className="text-white/70 text-sm bg-black/40 px-3 py-1 rounded-full">
              {currentIndex + 1} / {videos.length}
            </span>
          )}
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {videos.length > 1 && currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev() }}
          className={`absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 p-2 sm:p-3 bg-black/40 hover:bg-black/60 text-white rounded-full transition shadow-lg ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <ChevronLeft className="w-5 h-5 sm:w-7 sm:h-7" />
        </button>
      )}

      {videos.length > 1 && currentIndex < videos.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext() }}
          className={`absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 p-2 sm:p-3 bg-black/40 hover:bg-black/60 text-white rounded-full transition shadow-lg ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <ChevronRight className="w-5 h-5 sm:w-7 sm:h-7" />
        </button>
      )}

      <div
        className="relative w-full h-full max-w-[500px] flex items-center justify-center cursor-pointer"
        onClick={handlePlayPause}
      >
        <video
          ref={videoRef}
          src={video.url}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleVideoEnded}
          muted={isMuted}
          playsInline
          preload="auto"
        />

        <div
          className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${!isPlaying && showControls ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1" />
          </div>
        </div>

        {video.content && (
          <div
            className={`absolute bottom-20 left-4 right-4 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
          >
            <p className="text-white text-sm sm:text-base line-clamp-2 drop-shadow-lg">{video.content}</p>
          </div>
        )}
      </div>

      <div
        className={`absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-8 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="max-w-[500px] mx-auto">
          <div className="relative w-full h-1 bg-white/20 rounded-full mb-3 group cursor-pointer">
            <div
              className="absolute top-0 left-0 h-full bg-[#F97316] rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); handlePlayPause() }}
                className="p-2 text-white hover:bg-white/10 rounded-full transition"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleMuteToggle() }}
                className="p-2 text-white hover:bg-white/10 rounded-full transition"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <span className="text-white/70 text-xs sm:text-sm font-medium tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const ReelsTab: React.FC<ReelsTabProps> = ({ videos, isOwnProfile }) => {
  const [playerIndex, setPlayerIndex] = useState<number | null>(null)

  return (
    <>
      <div className="bg-white sm:rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Reels</h2>
        </div>
        <div className="p-2 sm:p-4">
          {videos.length === 0 ? (
            <EmptyState
              icon={Film}
              title="No reels yet"
              sub={isOwnProfile ? 'Your video posts will appear here as reels.' : 'No reels to show.'}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
              {videos.map((v, i) => (
                <div
                  key={`reel-${v.postId}-${i}`}
                  className="aspect-[9/16] rounded-lg overflow-hidden bg-black cursor-pointer hover:brightness-90 transition relative group"
                  onClick={() => setPlayerIndex(i)}
                >
                  <video
                    src={v.url}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                    onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                    onMouseLeave={(e) => {
                      const el = e.target as HTMLVideoElement
                      el.pause()
                      el.currentTime = 0
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <Play className="w-6 h-6 text-white ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs font-medium truncate">{v.content || 'Reel'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {playerIndex !== null && (
        <ReelPlayer
          videos={videos}
          initialIndex={playerIndex}
          onClose={() => setPlayerIndex(null)}
        />
      )}
    </>
  )
}

export default ReelsTab
