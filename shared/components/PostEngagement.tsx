'use client'

import React, { useState, useRef, useCallback } from 'react'
import { ThumbsUp, MessageCircle } from 'lucide-react'
import { PiShareFatLight } from 'react-icons/pi'
import ReactionTooltip from '@/features/social/components/ReactionTooltip'
import ReactionIcon, {
  REACTION_CONFIG,
  PICKER_REACTIONS,
  KIND_TO_EMOJI,
  ReactionKind,
} from './ReactionIcon'

export interface ReactionGroup {
  type: string
  count: number
  users: Array<{ id: string; full_name?: string; username?: string; avatar_url?: string | null }>
}

export interface PostEngagementProps {
  /** Reaction groups sorted by count */
  reactionGroups: ReactionGroup[]
  /** Total reaction count */
  totalReactionCount: number
  /** Comment count */
  commentsCount: number
  /** Share count (optional, not all post types track this) */
  sharesCount?: number
  /** View count (optional, for video posts) */
  viewsCount?: number
  /** Whether to show views count */
  showViews?: boolean
  /** Called when a reaction emoji is selected (default 👍 on click) */
  onLike: (emoji?: string) => void
  /** Called when Comment button or comment count clicked */
  onComment: () => void
  /** Called when Share button clicked */
  onShare: () => void
  /** Called when reaction area clicked (to open reactions modal) */
  onReactionsClick?: () => void
}

const PostEngagement: React.FC<PostEngagementProps> = ({
  reactionGroups,
  totalReactionCount,
  commentsCount,
  sharesCount = 0,
  viewsCount = 0,
  showViews = false,
  onLike,
  onComment,
  onShare,
  onReactionsClick,
}) => {
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const closeTimeout = useRef<NodeJS.Timeout | null>(null)

  const handleLikeHover = useCallback(() => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current)
      closeTimeout.current = null
    }
    setShowReactionPicker(true)
  }, [])

  const handleLikeLeave = useCallback(() => {
    closeTimeout.current = setTimeout(() => {
      setShowReactionPicker(false)
    }, 300)
  }, [])

  const handleReactionSelect = useCallback((kind: ReactionKind) => {
    setShowReactionPicker(false)
    onLike(KIND_TO_EMOJI[kind])
  }, [onLike])

  return (
    <div>
      {/* Stats Row */}
      <div className="flex items-center justify-between px-1 py-1">
        {/* Left: Reaction icon circles + total count */}
        <div className="flex items-center gap-1.5">
          {reactionGroups.length > 0 && (
            <div
              className="flex items-center gap-1 cursor-pointer group"
              onClick={(e) => {
                e.stopPropagation()
                onReactionsClick?.()
              }}
            >
              <div className="flex items-center -space-x-1">
                {reactionGroups.slice(0, 3).map((group, index) => (
                  <div
                    key={group.type}
                    className="relative"
                    style={{ zIndex: 10 - index }}
                    onMouseEnter={() => setHoveredReaction(group.type)}
                    onMouseLeave={() => setHoveredReaction(null)}
                  >
                    <ReactionIcon
                      type={group.type}
                      size={22}
                      className="border-[2px] border-white shadow-sm cursor-pointer"
                    />
                    <ReactionTooltip
                      users={group.users || []}
                      isVisible={hoveredReaction === group.type}
                    />
                  </div>
                ))}
              </div>
              {totalReactionCount > 0 && (
                <span className="text-[15px] text-gray-500 group-hover:underline">
                  {totalReactionCount}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: counts as text */}
        <div className="flex items-center gap-2 text-[13px] text-gray-500">
          {showViews && viewsCount > 0 && (
            <span className="hover:underline cursor-pointer">
              {viewsCount} {viewsCount === 1 ? 'view' : 'views'}
            </span>
          )}
          {commentsCount > 0 && (
            <span
              className="hover:underline cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                onComment()
              }}
            >
              {commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}
            </span>
          )}
          {sharesCount > 0 && (
            <span className="hover:underline cursor-pointer">
              {sharesCount} {sharesCount === 1 ? 'share' : 'shares'}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 pt-1">
        {/* Like button with hover reaction picker */}
        <div
          className="relative flex-1"
          onMouseEnter={handleLikeHover}
          onMouseLeave={handleLikeLeave}
        >
          {/* Reaction Picker Popup */}
          {showReactionPicker && (
            <div
              className="absolute bottom-full left-0 mb-2 z-50"
              onMouseEnter={handleLikeHover}
              onMouseLeave={handleLikeLeave}
            >
              <div className="flex items-end gap-0.5 bg-white rounded-full shadow-[0_3px_16px_rgba(0,0,0,0.18)] px-2 py-1.5">
                {PICKER_REACTIONS.map((kind) => {
                  const config = REACTION_CONFIG[kind]
                  return (
                    <button
                      key={kind}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleReactionSelect(kind)
                      }}
                      className="group/reaction relative flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200 ease-[cubic-bezier(0.17,0.67,0.21,1.4)] cursor-pointer hover:scale-[1.4] hover:-translate-y-2 active:scale-110"
                      title={config.label}
                    >
                      <ReactionIcon type={kind} size={40} />
                      <span
                        className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap opacity-0 group-hover/reaction:opacity-100 transition-all duration-150 pointer-events-none"
                      >
                        {config.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation()
              onLike('👍')
            }}
            className="flex w-full items-center justify-center gap-1.5 py-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-150 cursor-pointer rounded-lg text-sm font-medium"
            aria-label="Like post"
          >
            <ThumbsUp className="w-4 h-4" />
            <span>Like</span>
          </button>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onComment()
          }}
          className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition-colors duration-150 cursor-pointer rounded-lg text-sm font-medium"
          aria-label="Comment on post"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Comment</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onShare()
          }}
          className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors duration-150 cursor-pointer rounded-lg text-sm font-medium"
          aria-label="Share post"
        >
          <PiShareFatLight className="w-4 h-4" />
          <span>Share</span>
        </button>
      </div>
    </div>
  )
}

export default PostEngagement
