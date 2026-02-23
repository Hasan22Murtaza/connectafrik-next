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
import ReactionsModal from './ReactionsModal'

export interface ReactionGroup {
  type: string
  count: number
  users: Array<{ id: string; full_name?: string; username?: string; avatar_url?: string | null }>
}

export interface PostEngagementProps {
  reactionGroups: ReactionGroup[]
  totalReactionCount: number
  commentsCount: number
  sharesCount?: number
  viewsCount?: number
  showViews?: boolean
  onLike: (emoji?: string) => void
  onComment: () => void
  onShare: () => void
  onUserClick?: (username: string) => void
  postId?: string
  reactionsTable?: string
  postIdColumn?: string
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
  onUserClick,
  postId,
  reactionsTable,
  postIdColumn,
}) => {
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [showReactionsModal, setShowReactionsModal] = useState(false)
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
        <div className="flex items-center gap-1.5">
          {reactionGroups.length > 0 && (
            <div
              className="flex items-center gap-1 cursor-pointer group"
              onClick={(e) => {
                e.stopPropagation()
                setShowReactionsModal(true)
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
                      className="cursor-pointer"
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
        <div
          className="relative flex-1"
          onMouseEnter={handleLikeHover}
          onMouseLeave={handleLikeLeave}
        >
          {showReactionPicker && (
            <div
              className="absolute bottom-full left-0 mb-2 z-50 animate-[reactionPickerIn_280ms_cubic-bezier(0.34,1.56,0.64,1)_both]"
              onMouseEnter={handleLikeHover}
              onMouseLeave={handleLikeLeave}
            >
              <div className="flex items-center bg-white rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)] px-0.5 py-0.5">
                {PICKER_REACTIONS.map((kind, index) => {
                  return (
                    <button
                      key={kind}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleReactionSelect(kind)
                      }}
                      className="group/reaction relative flex items-center justify-center w-[32px] h-[32px] rounded-full cursor-pointer transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-[1.15] hover:-translate-y-1.5 active:scale-100"
                    >
                      <div className="animate-[reactionBounceIn_350ms_cubic-bezier(0.34,1.56,0.64,1)_both]" style={{ animationDelay: `${index * 30 + 80}ms` }}>
                        <ReactionIcon type={kind} size={30} />
                      </div>
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800/90 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap scale-0 group-hover/reaction:scale-100 opacity-0 group-hover/reaction:opacity-100 transition-all duration-150 origin-bottom pointer-events-none">
                        {REACTION_CONFIG[kind].label}
                      </span>
                    </button>
                  )
                })}
              </div>
              <style>{`
                @keyframes reactionPickerIn {
                  from { opacity: 0; transform: scale(0.8) translateY(8px); }
                  to   { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes reactionBounceIn {
                  0%   { opacity: 0; transform: scale(0) translateY(12px); }
                  60%  { opacity: 1; transform: scale(1.15) translateY(-2px); }
                  100% { opacity: 1; transform: scale(1) translateY(0); }
                }
              `}</style>
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

      <ReactionsModal
        isOpen={showReactionsModal}
        onClose={() => setShowReactionsModal(false)}
        reactionGroups={reactionGroups}
        onUserClick={onUserClick}
        postId={postId}
        reactionsTable={reactionsTable}
        postIdColumn={postIdColumn}
      />
    </div>
  )
}

export default PostEngagement
