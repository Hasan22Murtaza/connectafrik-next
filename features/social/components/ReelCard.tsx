import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Play, Pause, Volume2, VolumeX, UserPlus, UserCheck, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useReelInteractions } from '@/shared/hooks/useReels'
import { Reel } from '@/shared/types/reels'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import ReelComments from '@/features/social/components/ReelComments'
import { followUser, unfollowUser, checkIsFollowing } from '../services/followService'
import { VideoWatchTracker } from '../services/engagementTracking'

interface ReelCardProps {
  reel: Reel
  onLike?: (reelId: string) => void
  onComment?: (reelId: string) => void
  onShare?: (reelId: string) => void
  onSave?: (reelId: string) => void
  onFollow?: (authorId: string) => void
  onDelete?: (reelId: string) => void
  showComments?: boolean
  onToggleComments?: (reelId: string) => void
}

const ReelCard: React.FC<ReelCardProps> = ({
  reel,
  onLike,
  onComment,
  onShare,
  onSave,
  onFollow,
  onDelete,
  showComments = false,
  onToggleComments
}) => {
  const { user } = useAuth()
  const { toggleLike, toggleSave, recordView, shareReel, loading } = useReelInteractions(reel.id)

  // Video player state
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.5)
  const [showControls, setShowControls] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [likesCount, setLikesCount] = useState(reel.likes_count)
  const [savesCount, setSavesCount] = useState(reel.saves_count)
  const [showMenu, setShowMenu] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const watchTrackerRef = useRef<VideoWatchTracker | null>(null)

  // Check if user is following the reel author on mount
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (user && user.id !== reel.author_id) {
        const following = await checkIsFollowing(user.id, reel.author_id)
        setIsFollowing(following)
      }
    }
    checkFollowStatus()
  }, [user, reel.author_id])

  // Format time helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Handle video play/pause
  const handlePlayPause = useCallback(async () => {
    if (videoRef.current) {
      try {
        if (isPlaying) {
          videoRef.current.pause()
          setIsPlaying(false)
        } else {
          await videoRef.current.play()
          setIsPlaying(true)
        }
      } catch (error) {
        console.error('Video play/pause error:', error)
        // Don't update state if play failed
      }
    }
  }, [isPlaying])

  // Handle video time update
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime
      setCurrentTime(time)
      // Track watch progress
      watchTrackerRef.current?.updateProgress(time)
    }
  }, [])

  // Handle video loaded metadata
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
      // Initialize watch tracker when video loads
      if (user?.id && videoRef.current.duration) {
        watchTrackerRef.current = new VideoWatchTracker(
          reel.id,
          user.id,
          videoRef.current.duration,
          'reel'  // Mark as reel content
        )
      }
    }
  }, [reel.id, user?.id])

  // Handle video ended
  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    // Log watch event when video ends
    if (videoRef.current) {
      watchTrackerRef.current?.cleanup(videoRef.current.currentTime)
      videoRef.current.currentTime = 0
    }
  }, [])

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
    setIsMuted(newVolume === 0)
  }, [])

  // Handle mute toggle
  const handleMuteToggle = useCallback(() => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume
        setIsMuted(false)
      } else {
        videoRef.current.volume = 0
        setIsMuted(true)
      }
    }
  }, [isMuted, volume])

  // Handle seek
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }, [])

  // Handle like
  const handleLike = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to like reels')
      return
    }

    try {
      const { success, error } = await toggleLike()
      if (success) {
        setIsLiked(!isLiked)
        setLikesCount(prev => isLiked ? prev - 1 : prev + 1)
        onLike?.(reel.id)
      } else if (error) {
        toast.error(error)
      }
    } catch (err) {
      console.error('Error toggling like:', err)
      toast.error('Failed to like reel')
    }
  }, [user, toggleLike, isLiked, onLike, reel.id])

  // Handle save
  const handleSave = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to save reels')
      return
    }

    try {
      const { success, error } = await toggleSave()
      if (success) {
        setIsSaved(!isSaved)
        setSavesCount(prev => isSaved ? prev - 1 : prev + 1)
        onSave?.(reel.id)
      } else if (error) {
        toast.error(error)
      }
    } catch (err) {
      console.error('Error toggling save:', err)
      toast.error('Failed to save reel')
    }
  }, [user, toggleSave, isSaved, onSave, reel.id])

  // Handle share
  const handleShare = useCallback(async () => {
    if (user) {
      try {
        await shareReel('copy_link')
      } catch (err) {
        console.error('Error recording reel share:', err)
      }
    }

    onShare?.(reel.id)
  }, [user, shareReel, onShare, reel.id])

  // Handle comment
  const handleComment = useCallback(() => {
    onComment?.(reel.id)
    onToggleComments?.(reel.id)
  }, [onComment, onToggleComments, reel.id])

  // Handle follow
  const handleFollow = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to tap in')
      return
    }

    try {
      if (isFollowing) {
        const success = await unfollowUser(user.id, reel.author_id)
        if (success) {
          setIsFollowing(false)
          toast.success('Untapped')
        } else {
          toast.error('Failed to untap')
        }
      } else {
        const success = await followUser(user.id, reel.author_id)
        if (success) {
          setIsFollowing(true)
          toast.success('Tapped in!')
        } else {
          // Check if already following (failed because duplicate)
          const stillFollowing = await checkIsFollowing(user.id, reel.author_id)
          if (stillFollowing) {
            setIsFollowing(true)
            toast.success('Already tapped in!')
          } else {
            toast.error('Failed to tap in')
          }
        }
      }
      onFollow?.(reel.author_id)
    } catch (error) {
      console.error('Error handling follow:', error)
      toast.error('Something went wrong')
    }
  }, [user, isFollowing, reel.author_id, onFollow])

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!user || user.id !== reel.author_id) {
      toast.error('You can only delete your own reels')
      return
    }

    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this reel? This action cannot be undone.')) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/reels/${reel.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete reel')
      }

      toast.success('Reel deleted successfully')
      onDelete?.(reel.id)
      setShowMenu(false)
    } catch (error) {
      console.error('Error deleting reel:', error)
      toast.error('Failed to delete reel')
    } finally {
      setIsDeleting(false)
    }
  }, [user, reel.id, reel.author_id, onDelete])

  // Handle mouse enter/leave for controls
  const handleMouseEnter = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false)
    }, 2000)
  }, [])

  // Record view when video starts playing
  useEffect(() => {
    if (isPlaying && user) {
      recordView()
    }
  }, [isPlaying, user, recordView])

  // Cleanup timeout and watch tracker on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
      // Log watch event on unmount
      if (videoRef.current) {
        watchTrackerRef.current?.cleanup(videoRef.current.currentTime)
      }
    }
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Video Container */}
      <div
        className="relative bg-black w-full"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseEnter}
        onTouchEnd={handleMouseLeave}
      >
        <div className="relative aspect-[9/16] w-full">
          <video
            ref={videoRef}
            src={reel.video_url}
            poster={reel.thumbnail_url}
            className="absolute inset-0 h-full w-full object-cover cursor-pointer"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleVideoEnded}
            onClick={handlePlayPause}
            muted={isMuted}
            playsInline
            webkit-playsinline="true"
            preload="metadata"
            onError={(e) => {
              console.error('Video load error:', e);
              // Show fallback content
              const target = e.target as HTMLVideoElement;
              if (target.parentElement) {
                target.parentElement.innerHTML = `
                  <div class="w-full h-64 sm:h-96 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <div class="text-center text-white max-w-xs px-4">
                      <div class="text-lg font-semibold mb-2">⚠️ Video Unavailable</div>
                      <p class="text-sm text-gray-300 mb-2">${reel.title || 'Untitled'}</p>
                      <p class="text-xs text-gray-400">The video file could not be loaded. Please try again later.</p>
                    </div>
                  </div>
                `;
              }
            }}
          />

          {/* Persistent Mobile Mute/Unmute Button - Always visible on mobile */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleMuteToggle()
            }}
            className="sm:hidden absolute top-4 right-4 z-20 p-3 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-black/70 transition-colors shadow-lg"
            aria-label={isMuted ? "Unmute video" : "Mute video"}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
        {/* Video Controls Overlay */}
        {showControls && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent">
            {/* Top Controls */}
            <div className="absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="flex items-center space-x-1 sm:space-x-2">
                  {reel.profiles?.avatar_url ? (
                    <img
                  src={reel.profiles.avatar_url}
                  alt={reel.profiles.full_name}
                      className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 font-medium text-xs sm:text-sm">
                        {(reel.profiles?.full_name || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-white text-xs sm:text-sm font-medium">
                  {reel.profiles?.full_name || 'Anonymous User'}
                    </p>
                    <p className="text-gray-300 text-xs">{formatDistanceToNow(new Date(reel.created_at), { addSuffix: true })}</p>
                  </div>
                </div>
              </div>
              
              {(!user || user.id !== reel.author_id) && (
                <button
                  onClick={handleFollow}
                  className={`flex items-center space-x-1 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                    isFollowing
                      ? 'bg-gray-600 text-white hover:bg-gray-700'
                      : 'bg-orange-500 text-white hover:bg-orange-600'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="w-3 h-3" />
                      <span className="hidden sm:inline">UnTap In</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3 h-3" />
                      <span className="hidden sm:inline">Tap In</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Center Play Button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={handlePlayPause}
                className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                {isPlaying ? <Pause className="w-6 h-6 sm:w-8 sm:h-8" /> : <Play className="w-6 h-6 sm:w-8 sm:h-8 ml-1" />}
              </button>
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4">
              {/* Progress Bar */}
              <div className="mb-2 sm:mb-4">
                <input
                  type="range"
                  min="0"
                  max={duration}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-white mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Volume Control - Hidden on mobile */}
              <div className="hidden sm:flex items-center space-x-2 mb-4">
                <button
                  onClick={handleMuteToggle}
                  className="text-white hover:text-gray-300 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <button
                    onClick={handleLike}
                    disabled={loading}
                    className={`flex items-center space-x-1 text-white hover:text-red-400 transition-colors ${
                      isLiked ? 'text-red-400' : ''
                    }`}
                  >
                    <Heart className={`w-5 h-5 sm:w-6 sm:h-6 ${isLiked ? 'fill-current' : ''}`} />
                    <span className="text-xs sm:text-sm font-medium">{likesCount}</span>
                  </button>

                  <button
                    onClick={handleComment}
                    className="flex items-center space-x-1 text-white hover:text-blue-400 transition-colors"
                  >
                    <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="text-xs sm:text-sm font-medium">{reel.comments_count}</span>
                  </button>

                  <button
                    onClick={handleShare}
                    disabled={loading}
                    className="flex items-center space-x-1 text-white hover:text-green-400 transition-colors"
                  >
                    <Share2 className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="text-xs sm:text-sm font-medium">{reel.shares_count}</span>
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className={`text-white hover:text-yellow-400 transition-colors ${
                      isSaved ? 'text-yellow-400' : ''
                    }`}
                  >
                    <Bookmark className={`w-5 h-5 sm:w-6 sm:h-6 ${isSaved ? 'fill-current' : ''}`} />
                  </button>

                  {/* Menu Button */}
                  <div className="relative">
                    <button
                      onClick={() => setShowMenu(!showMenu)}
                      className="text-white hover:text-gray-300 transition-colors"
                    >
                      <MoreHorizontal className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>

                    {/* Dropdown Menu */}
                    {showMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50">
                        {/* Show delete option only for the reel owner */}
                        {user && user.id === reel.author_id && (
                          <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition-colors flex items-center space-x-2 disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>{isDeleting ? 'Deleting...' : 'Delete Reel'}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Play Button Overlay (when not playing) */}
        {!isPlaying && !showControls && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={handlePlayPause}
              className="w-12 h-12 sm:w-16 sm:h-16 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <Play className="w-6 h-6 sm:w-8 sm:h-8 ml-1" />
            </button>
          </div>
        )}
      </div>

      {/* Reel Info */}
      <div className="p-3 sm:p-4">
        <div className="flex items-start space-x-2 sm:space-x-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-gray-600 font-medium text-xs sm:text-sm">
                U
              </span>
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                {reel.profiles?.full_name || 'Anonymous User'}
              </h3>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(reel.created_at), { addSuffix: true })}
              </span>
            </div>
            
            <h4 className="text-sm sm:text-base font-medium text-gray-900 mb-2">{reel.title}</h4>
            
            {reel.description && (
              <p className="text-xs sm:text-sm text-gray-600 mb-3 line-clamp-2">{reel.description}</p>
            )}

            {/* Tags */}
            {reel.tags && reel.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {reel.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
                {reel.tags.length > 3 && (
                  <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                    +{reel.tags.length - 3} more
                  </span>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center space-x-3 sm:space-x-4 text-xs text-gray-500">
              <span>{reel.views_count} views</span>
              <span>{formatTime(reel.duration)}</span>
              <span className="capitalize">{reel.category}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Comments Modal */}
      <ReelComments
        reelId={reel.id}
        isOpen={showComments}
        onClose={() => onToggleComments?.(reel.id)}
      />
    </div>
  )
}

export default ReelCard
