import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Play, Pause, Volume2, VolumeX, Heart, MessageCircle, Share, ChevronLeft, ChevronRight, Music, Trash2, MoreHorizontal } from 'lucide-react'
import { Story } from '@/features/social/services/storiesService'
import { storiesService } from '@/features/social/services/storiesService'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'react-hot-toast'

interface StoriesViewerProps {
  isOpen: boolean
  onClose: () => void
  stories: Story[]
  initialStoryIndex?: number
}

const StoriesViewer: React.FC<StoriesViewerProps> = ({
  isOpen,
  onClose,
  stories,
  initialStoryIndex = 0
}) => {
  const { user } = useAuth()
  const [currentStoryIndex, setCurrentStoryIndex] = useState(initialStoryIndex)
  const [isPlaying, setIsPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [hasViewed, setHasViewed] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const storyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const currentStory = stories[currentStoryIndex]

  // Record story view when component mounts or story changes
  useEffect(() => {
    if (currentStory && user && !hasViewed) {
      storiesService.recordStoryView(currentStory.id, user.id)
        .then(() => setHasViewed(true))
        .catch(error => console.error('Error recording story view:', error))
    }
  }, [currentStory, user, hasViewed])

  // Handle story progression
  useEffect(() => {
    if (!isOpen || !currentStory) return

    // Reset state for new story
    setProgress(0)
    setHasViewed(false)
    setIsPlaying(true)

    // Clear existing timeouts
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }
    if (storyTimeoutRef.current) {
      clearTimeout(storyTimeoutRef.current)
    }

    // Start progress tracking
    const startTime = Date.now()
    const duration = currentStory.media_type === 'video' ? 15 : 5 // 15s for video, 5s for image

    progressIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      const newProgress = Math.min((elapsed / duration) * 100, 100)
      setProgress(newProgress)

      if (newProgress >= 100) {
        // Move to next story
        if (currentStoryIndex < stories.length - 1) {
          setCurrentStoryIndex(prev => prev + 1)
        } else {
          onClose()
        }
      }
    }, 100)

    // Auto-advance after duration
    storyTimeoutRef.current = setTimeout(() => {
      if (currentStoryIndex < stories.length - 1) {
        setCurrentStoryIndex(prev => prev + 1)
      } else {
        onClose()
      }
    }, duration * 1000)

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
      if (storyTimeoutRef.current) {
        clearTimeout(storyTimeoutRef.current)
      }
    }
  }, [isOpen, currentStory, currentStoryIndex, stories.length, onClose])

  // Handle video play/pause
  const togglePlayPause = useCallback(() => {
    if (currentStory?.media_type === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }, [currentStory, isPlaying])

  // Handle music play/pause
  const toggleMusic = useCallback(() => {
    if (currentStory?.music_url && audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume
        audioRef.current.play()
      } else {
        audioRef.current.pause()
      }
      setIsMuted(!isMuted)
    }
  }, [currentStory, isMuted, volume])

  // Handle volume change
  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
  }, [])

  // Navigate to previous story
  const goToPreviousStory = useCallback(() => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1)
    }
  }, [currentStoryIndex])

  // Navigate to next story
  const goToNextStory = useCallback(() => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1)
    } else {
      onClose()
    }
  }, [currentStoryIndex, stories.length, onClose])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'ArrowLeft':
          goToPreviousStory()
          break
        case 'ArrowRight':
          goToNextStory()
          break
        case ' ':
          e.preventDefault()
          togglePlayPause()
          break
        case 'Escape':
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isOpen, goToPreviousStory, goToNextStory, togglePlayPause, onClose])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
      if (storyTimeoutRef.current) {
        clearTimeout(storyTimeoutRef.current)
      }
    }
  }, [])

  if (!isOpen || !currentStory) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      {/* Background */}
      <div className="absolute inset-0">
        {currentStory.media_type === 'image' ? (
          <img
            src={currentStory.media_url}
            alt="Story"
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            src={currentStory.media_url}
            className="w-full h-full object-cover"
            autoPlay
            muted={isMuted}
            loop
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        )}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src={currentStory.user_avatar || '/default-avatar.png'}
              alt={currentStory.user_name}
              className="w-10 h-10 rounded-full border-2 border-white"
            />
            <div>
              <h3 className="text-white font-semibold">{currentStory.user_name}</h3>
              <p className="text-white/80 text-sm">now</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Bars */}
        <div className="flex space-x-1 mt-4">
          {stories.map((_, index) => (
            <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  index < currentStoryIndex ? 'bg-white' :
                  index === currentStoryIndex ? 'bg-white' : 'bg-white/30'
                }`}
                style={{
                  width: index === currentStoryIndex ? `${progress}%` : 
                         index < currentStoryIndex ? '100%' : '0%'
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="text-center text-white max-w-md">
          {currentStory.caption && (
            <p className="text-lg font-medium mb-4">{currentStory.caption}</p>
          )}
          
          {currentStory.music_title && (
            <div className="flex items-center justify-center space-x-2 text-sm">
              <Music className="w-4 h-4" />
              <span>{currentStory.music_title} - {currentStory.music_artist}</span>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-4">
        <div className="flex items-center justify-between">
          {/* Music Controls */}
          {currentStory.music_url && (
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMusic}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              {!isMuted && (
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-20"
                />
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center space-x-4">
            <button className="text-white hover:bg-white/20 rounded-full p-2 transition-colors">
              <Heart className="w-5 h-5" />
            </button>
            <button className="text-white hover:bg-white/20 rounded-full p-2 transition-colors">
              <MessageCircle className="w-5 h-5" />
            </button>
            <button className="text-white hover:bg-white/20 rounded-full p-2 transition-colors">
              <Share className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Areas */}
      <div className="absolute inset-0 flex">
        {/* Previous Story */}
        <div
          className="flex-1 cursor-pointer"
          onClick={goToPreviousStory}
        />
        {/* Next Story */}
        <div
          className="flex-1 cursor-pointer"
          onClick={goToNextStory}
        />
      </div>

      {/* Navigation Arrows */}
      {currentStoryIndex > 0 && (
        <button
          onClick={goToPreviousStory}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/20 rounded-full p-2 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {currentStoryIndex < stories.length - 1 && (
        <button
          onClick={goToNextStory}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/20 rounded-full p-2 transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Play/Pause Button for Videos */}
      {currentStory.media_type === 'video' && (
        <button
          onClick={togglePlayPause}
          className="absolute inset-0 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
        >
          {!isPlaying && <Play className="w-16 h-16" />}
        </button>
      )}

      {/* Hidden audio element for music */}
      {currentStory.music_url && (
        <audio
          ref={audioRef}
          src={currentStory.music_url}
          loop={true}
          muted={isMuted}
          onEnded={() => setIsMuted(true)}
          style={{ display: 'none' }}
        />
      )}
    </div>
  )
}

export default StoriesViewer
