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

  // Format number helper
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
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
    <div className="relative w-full bg-black overflow-hidden rounded-lg">
      {/* Video Container - TikTok Style */}
      <div
        className="relative w-full aspect-[9/16] max-h-[90vh] mx-auto bg-black"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseEnter}
        onTouchEnd={handleMouseLeave}
        onClick={handlePlayPause}
      >
        <video
          ref={videoRef}
          src={reel.video_url}
          poster={reel.thumbnail_url}
          className="absolute inset-0 h-full w-full object-cover"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleVideoEnded}
          muted={isMuted}
          playsInline
          webkit-playsinline="true"
          preload="metadata"
          loop
          onError={(e) => {
            console.error('Video load error:', e);
            const target = e.target as HTMLVideoElement;
            if (target.parentElement) {
              target.parentElement.innerHTML = `
                <div class="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
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

        {/* Gradient Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none z-10" />

        {/* Top Left Controls - Play/Pause and Mute */}
        <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handlePlayPause()
            }}
            className="p-2.5 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-black/80 transition-all duration-200 shadow-lg border border-white/10"
            aria-label={isPlaying ? "Pause video" : "Play video"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleMuteToggle()
            }}
            className="p-2.5 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-black/80 transition-all duration-200 shadow-lg border border-white/10"
            aria-label={isMuted ? "Unmute video" : "Mute video"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Right Side Engagement Metrics - TikTok Style */}
        <div className="absolute right-2 sm:right-4 bottom-24 z-30 flex flex-col items-center gap-5">
          {/* Profile Picture */}
          <div className="relative group">
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (!isFollowing && user) {
                  handleFollow()
                }
              }}
              className="relative transition-transform duration-200 hover:scale-110"
            >
              <div className="relative">
                {reel.profiles?.avatar_url ? (
                  <img
                    src={reel.profiles.avatar_url}
                    alt={reel.profiles.full_name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-lg"
                  />
                ) : (
                  <div className="w-14 h-14 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                    <span className="text-white font-bold text-xl">
                      {(reel.profiles?.full_name || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                {!isFollowing && user && user.id !== reel.author_id && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white rounded-full p-0.5 shadow-md">
                    <UserPlus className="w-4 h-4 text-orange-500" />
                  </div>
                )}
              </div>
            </button>
          </div>

          {/* Like Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleLike()
              }}
              disabled={loading}
              className={`p-3.5 rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95 ${
                isLiked 
                  ? 'bg-red-500/30 shadow-lg shadow-red-500/30' 
                  : 'bg-black/40 backdrop-blur-md hover:bg-black/60'
              }`}
            >
              <Heart 
                className={`w-8 h-8 transition-all duration-200 ${
                  isLiked 
                    ? 'text-red-500 fill-red-500 scale-110' 
                    : 'text-white'
                }`} 
              />
            </button>
            <span className="text-white text-xs font-bold drop-shadow-lg">
              {formatNumber(likesCount)}
            </span>
          </div>

          {/* Comment Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleComment()
              }}
              className="p-3.5 bg-black/40 backdrop-blur-md rounded-full hover:bg-black/60 transition-all duration-200 transform hover:scale-110 active:scale-95"
            >
              <MessageCircle className="w-8 h-8 text-white" />
            </button>
            <span className="text-white text-xs font-bold drop-shadow-lg">
              {formatNumber(reel.comments_count)}
            </span>
          </div>

          {/* Share Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleShare()
              }}
              disabled={loading}
              className="p-3.5 bg-black/40 backdrop-blur-md rounded-full hover:bg-black/60 transition-all duration-200 transform hover:scale-110 active:scale-95"
            >
              <Share2 className="w-8 h-8 text-white" />
            </button>
            <span className="text-white text-xs font-bold drop-shadow-lg">
              {formatNumber(reel.shares_count)}
            </span>
          </div>

          {/* Bookmark Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleSave()
              }}
              disabled={loading}
              className={`p-3.5 rounded-full transition-all duration-200 transform hover:scale-110 active:scale-95 ${
                isSaved 
                  ? 'bg-yellow-500/30 shadow-lg shadow-yellow-500/30' 
                  : 'bg-black/40 backdrop-blur-md hover:bg-black/60'
              }`}
            >
              <Bookmark 
                className={`w-8 h-8 transition-all duration-200 ${
                  isSaved 
                    ? 'text-yellow-400 fill-yellow-400 scale-110' 
                    : 'text-white'
                }`} 
              />
            </button>
          </div>

          {/* More Options */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              className="p-3.5 bg-black/40 backdrop-blur-md rounded-full hover:bg-black/60 transition-all duration-200 transform hover:scale-110 active:scale-95"
            >
              <MoreHorizontal className="w-8 h-8 text-white" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 bottom-full mb-3 w-52 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl py-2 z-50 border border-gray-200/50">
                {user && user.id === reel.author_id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete()
                      setShowMenu(false)
                    }}
                    disabled={isDeleting}
                    className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors flex items-center space-x-2 disabled:opacity-50 font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isDeleting ? 'Deleting...' : 'Delete Reel'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Left User Info - TikTok Style */}
        <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 right-24 z-30 text-white">
          <div className="flex items-center gap-2.5 mb-2.5">
            <h3 className="text-base sm:text-lg font-bold drop-shadow-lg">
              @{reel.profiles?.full_name?.toLowerCase().replace(/\s+/g, '') || 'anonymous'}
            </h3>
            {(!user || user.id !== reel.author_id) && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleFollow()
                }}
                className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg ${
                  isFollowing
                    ? 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-md'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                {isFollowing ? (
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    Following
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" />
                    Follow
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Description */}
          {reel.description && (
            <p className="text-sm sm:text-base mb-2 line-clamp-2 pr-2 font-medium drop-shadow-md">
              {reel.description}
            </p>
          )}

          {/* Music/Audio Info */}
          <div className="flex items-center gap-2 text-sm sm:text-base mb-2">
            <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
              <span className="text-lg">🎵</span>
              <span className="font-semibold text-white/95">{reel.title || 'Original audio'}</span>
            </div>
          </div>

          {/* Tags */}
          {reel.tags && reel.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {reel.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-sm font-semibold text-white/95 drop-shadow-md hover:text-white transition-colors cursor-pointer"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Views and Time */}
          <div className="text-xs sm:text-sm text-white/80 font-medium drop-shadow-md">
            {formatNumber(reel.views_count)} views • {formatDistanceToNow(new Date(reel.created_at), { addSuffix: true })}
          </div>
        </div>

        {/* Center Play Button Overlay (when paused) */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handlePlayPause()
              }}
              className="w-20 h-20 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-2xl border border-white/20 pointer-events-auto"
            >
              <Play className="w-10 h-10 ml-1" />
            </button>
          </div>
        )}
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
