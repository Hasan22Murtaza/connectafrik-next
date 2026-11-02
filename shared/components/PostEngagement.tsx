'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { MessageCircle } from '@/shared/icons'
import { Heart } from 'lucide-react'
import { PiShareFatLight } from 'react-icons/pi'
import ReactionTooltip from '@/features/social/components/ReactionTooltip'
import ReactionIcon, {
  REACTION_CONFIG,
  PICKER_REACTIONS,
  KIND_TO_EMOJI,
  getReactionKind,
  ReactionKind,
} from './ReactionIcon'
import ReactionsModal from './ReactionsModal'

export interface ReactionGroup {
  type: string
  count: number
  users: Array<{ id: string; full_name?: string; username?: string; avatar_url?: string | null }>
  currentUserReacted?: boolean
}

export interface PostEngagementProps {
  reactionGroups: ReactionGroup[]
  totalReactionCount: number
  commentsCount: number
  sharesCount?: number
  viewsCount?: number
  showViews?: boolean
  /** When true, the current user has already shared this post (highlights the Share action). */
  isShared?: boolean
  onLike: (emoji?: string) => void | boolean | Promise<void | boolean>
  onComment: () => void
  onShare: () => void
  onUserClick?: (userId: string) => void
  postId?: string
  reactionsEndpoint?: string
}

const PostEngagement: React.FC<PostEngagementProps> = ({
  reactionGroups,
  totalReactionCount,
  commentsCount,
  sharesCount = 0,
  viewsCount = 0,
  showViews = false,
  isShared = false,
  onLike,
  onComment,
  onShare,
  onUserClick,
  postId,
  reactionsEndpoint,
}) => {
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [showReactionsModal, setShowReactionsModal] = useState(false)
  const [reactionOverride, setReactionOverride] = useState<ReactionKind | null | undefined>(undefined)
  const closeTimeout = useRef<NodeJS.Timeout | null>(null)
  const reactionRequestId = useRef(0)
  const propUserReaction = reactionGroups.find((group) => group.currentUserReacted)?.type
  const hasOptimisticReaction = reactionOverride !== undefined
  const userReaction = hasOptimisticReaction
    ? reactionOverride || undefined
    : propUserReaction
  const userReactionKind = userReaction ? getReactionKind(userReaction) : undefined
  const userReactionConfig = userReactionKind ? REACTION_CONFIG[userReactionKind] : undefined
  const displayedReactionGroups = hasOptimisticReaction
    ? (() => {
      const nextReaction = reactionOverride || undefined
      const groups = reactionGroups.map((group) => ({
        ...group,
        count: Math.max(
          0,
          group.count - Number(group.type === propUserReaction) + Number(group.type === nextReaction)
        ),
        currentUserReacted: group.type === nextReaction && nextReaction !== undefined,
      }))

      if (nextReaction && !groups.some((group) => group.type === nextReaction)) {
        groups.push({
          type: nextReaction,
          count: 1,
          users: [],
          currentUserReacted: true,
        })
      }

      return groups.filter((group) => group.count > 0).sort((a, b) => b.count - a.count)
    })()
    : reactionGroups
  const displayedReactionCount = hasOptimisticReaction
    ? Math.max(
      0,
      totalReactionCount + Number(Boolean(reactionOverride)) - Number(Boolean(propUserReaction))
    )
    : totalReactionCount

  useEffect(() => {
    const handleReactionUpdate = (event: Event) => {
      const { detail } = event as CustomEvent<{
        postId?: string
        action?: string
        reactionType?: string
      }>
      if (detail?.postId !== postId || !detail.reactionType) return

      setReactionOverride(detail.action === 'removed' ? null : detail.reactionType as ReactionKind)
    }

    window.addEventListener('reaction-updated', handleReactionUpdate)
    window.addEventListener('group-reaction-updated', handleReactionUpdate)
    return () => {
      window.removeEventListener('reaction-updated', handleReactionUpdate)
      window.removeEventListener('group-reaction-updated', handleReactionUpdate)
    }
  }, [postId])

  useEffect(() => {
    if (
      reactionOverride !== undefined &&
      (propUserReaction ?? null) === reactionOverride
    ) {
      setReactionOverride(undefined)
    }
  }, [propUserReaction, reactionOverride])

  const applyReaction = useCallback(async (nextReaction: ReactionKind | null, emoji: string) => {
    const requestId = ++reactionRequestId.current
    setReactionOverride(nextReaction)

    try {
      const succeeded = await onLike(emoji)
      if (succeeded === false && requestId === reactionRequestId.current) {
        setReactionOverride(undefined)
      }
    } catch {
      if (requestId === reactionRequestId.current) {
        setReactionOverride(undefined)
      }
    }
  }, [onLike])


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
    void applyReaction(userReactionKind === kind ? null : kind, KIND_TO_EMOJI[kind])
  }, [applyReaction, userReactionKind])

  return (
    <div>
      <div className="flex items-center justify-between gap-2  px-1 pt-1">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="relative shrink-0"
            onMouseEnter={handleLikeHover}
            onMouseLeave={handleLikeLeave}
          >
            {showReactionPicker && (
              <div
                className="absolute bottom-full left-0 mb-2 z-50 animate-[reactionPickerIn_280ms_cubic-bezier(0.34,1.56,0.64,1)_both]"
                onMouseEnter={handleLikeHover}
                onMouseLeave={handleLikeLeave}
              >
                <div className="flex items-center bg-white rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)] px-2 py-1 gap-1">
                  {PICKER_REACTIONS.map((kind, index) => (
                    <button
                      key={kind}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleReactionSelect(kind)
                      }}
                      className="group/reaction noto-color-emoji-regular relative flex items-center justify-center w-[32px] h-[32px] rounded-full cursor-pointer transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-[1.15] hover:-translate-y-1.5 active:scale-100"
                    >
                      <div className="animate-[reactionBounceIn_350ms_cubic-bezier(0.34,1.56,0.64,1)_both]" style={{ animationDelay: `${index * 30 + 80}ms` }}>
                        <ReactionIcon type={kind} size={30} />
                      </div>
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800/90 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap scale-0 group-hover/reaction:scale-100 opacity-0 group-hover/reaction:opacity-100 transition-all duration-150 origin-bottom pointer-events-none">
                        {REACTION_CONFIG[kind].label}
                      </span>
                    </button>
                  ))}
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
                void applyReaction(
                  userReaction ? null : 'love',
                  userReactionKind ? KIND_TO_EMOJI[userReactionKind] : KIND_TO_EMOJI.love
                )
              }}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-full bg-[#f3f4fb] px-3 text-sm font-medium transition-colors duration-150 ${
                userReactionConfig
                  ? `${userReactionKind === 'love'
                    ? 'text-red-500'
                    : userReactionKind === 'like'
                      ? 'text-blue-600'
                      : 'text-amber-500'
                  } ${userReactionConfig.hoverBg}`
                  : 'text-[#f28b45] hover:bg-orange-50'
              }`}
              aria-label={userReactionConfig ? `${userReactionConfig.label} reaction` : 'Like post'}
            >
              {userReactionConfig ? (
                <ReactionIcon type={userReaction!} size={18} />
              ) : (
                <Heart className="h-[17px] w-[17px]" strokeWidth={2} />
              )}
              {displayedReactionCount > 0 && (
                <span className="text-xs font-semibold tabular-nums text-slate-500">
                  {displayedReactionCount}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation()
              onComment()
            }}
            className="flex h-8 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3f4fb] text-slate-400 transition-colors hover:bg-orange-50 hover:text-orange-500"
            aria-label={`Comment on post${commentsCount > 0 ? `, ${commentsCount} ${commentsCount === 1 ? 'comment' : 'comments'}` : ''}`}
            title={commentsCount > 0 ? `${commentsCount} ${commentsCount === 1 ? 'comment' : 'comments'}` : 'Comment'}
          >
            <MessageCircle className="h-4 w-4" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              onShare()
            }}
            className="flex h-8 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3f4fb] text-green-500 transition-colors hover:bg-green-50"
            aria-label={`${isShared ? 'Shared post' : 'Share post'}${sharesCount > 0 ? `, ${sharesCount} ${sharesCount === 1 ? 'share' : 'shares'}` : ''}`}
            title={sharesCount > 0 ? `${sharesCount} ${sharesCount === 1 ? 'share' : 'shares'}` : isShared ? 'Shared' : 'Share'}
            aria-pressed={isShared}
          >
            <PiShareFatLight className="h-[17px] w-[17px]" />
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-1">
          {showViews && viewsCount > 0 && (
            <span className="mr-1 text-[11px] text-slate-400" aria-label={`${viewsCount} ${viewsCount === 1 ? 'view' : 'views'}`}>
              {viewsCount} {viewsCount === 1 ? 'view' : 'views'}
            </span>
          )}
          {displayedReactionGroups.length > 0 && (
            <button
              type="button"
              className="flex items-center"
              onClick={(e) => {
                e.stopPropagation()
                setShowReactionsModal(true)
              }}
              aria-label={`View ${displayedReactionCount} reactions`}
            >
              <span className="flex items-center -space-x-1">
                {displayedReactionGroups.slice(0, 3).map((group, index) => (
                  <span
                    key={group.type}
                    className="relative"
                    style={{ zIndex: 10 - index }}
                    onMouseEnter={() => setHoveredReaction(group.type)}
                    onMouseLeave={() => setHoveredReaction(null)}
                  >
                    <ReactionIcon type={group.type} size={19} />
                    <ReactionTooltip
                      users={group.users || []}
                      isVisible={hoveredReaction === group.type}
                    />
                  </span>
                ))}
              </span>
            </button>
          )}
        </div>
      </div>

      <ReactionsModal
        isOpen={showReactionsModal}
        onClose={() => setShowReactionsModal(false)}
        reactionGroups={displayedReactionGroups}
        onUserClick={onUserClick}
        reactionsEndpoint={reactionsEndpoint || (postId ? `/api/posts/${postId}/reaction` : undefined)}
      />
    </div>
  )
}

export default PostEngagement
