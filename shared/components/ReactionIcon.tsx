'use client'

import React from 'react'
import Image from 'next/image'

export type ReactionKind = 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry' | 'care' | 'idea' | 'clap'

interface ReactionConfig {
  image: string
  label: string
  hoverBg: string
}

/** Central config for every reaction type */
export const REACTION_CONFIG: Record<ReactionKind, ReactionConfig> = {
  like: {
    image: '/assets/reaction-icons/like.png',
    label: 'Like',
    hoverBg: 'hover:bg-blue-50',
  },
  love: {
    image: '/assets/reaction-icons/heart.png',
    label: 'Love',
    hoverBg: 'hover:bg-red-50',
  },
  laugh: {
    image: '/assets/reaction-icons/laugh.png',
    label: 'Haha',
    hoverBg: 'hover:bg-yellow-50',
  },
  wow: {
    image: '/assets/reaction-icons/wow.png',
    label: 'Wow',
    hoverBg: 'hover:bg-yellow-50',
  },
  sad: {
    image: '/assets/reaction-icons/think.png',
    label: 'think',
    hoverBg: 'hover:bg-yellow-50',
  },
  angry: {
    image: '/assets/reaction-icons/angry.png',
    label: 'Angry',
    hoverBg: 'hover:bg-orange-50',
  },
  care: {
    image: '/assets/reaction-icons/care.png',
    label: 'Care',
    hoverBg: 'hover:bg-yellow-50',
  },
  idea: {
    image: '/assets/reaction-icons/Idea.png',
    label: 'Idea',
    hoverBg: 'hover:bg-yellow-50',
  },
  clap: {
    image: '/assets/reaction-icons/claping.png',
    label: 'Clap',
    hoverBg: 'hover:bg-yellow-50',
  },
}

/** Order of reactions shown in the hover picker (matches Facebook) */
export const PICKER_REACTIONS: ReactionKind[] = ['like', 'love', 'care', 'laugh', 'wow', 'sad', 'angry']

/** Map emoji strings to reaction kinds for backward compat */
export const EMOJI_TO_KIND: Record<string, ReactionKind> = {
  '👍': 'like',
  '❤️': 'love',
  '🤣': 'laugh',
  '😆': 'laugh',
  '😂': 'laugh',
  '😮': 'wow',
  '😯': 'wow',
  '😢': 'sad',
  '😥': 'sad',
  '😡': 'angry',
  '😠': 'angry',
  '🤗': 'care',
  '🙏': 'care',
  '💡': 'idea',
  '🤔': 'idea',
  '👏': 'clap',
  '🙌': 'clap',
}

/** Map reaction kind back to its legacy emoji */
export const KIND_TO_EMOJI: Record<ReactionKind, string> = {
  like: '👍',
  love: '❤️',
  laugh: '🤣',
  wow: '😮',
  sad: '😢',
  angry: '😡',
  care: '🤗',
  idea: '💡',
  clap: '👏',
}

export function getReactionKind(type: string): ReactionKind {
  if (Object.prototype.hasOwnProperty.call(REACTION_CONFIG, type)) {
    return type as ReactionKind
  }
  return EMOJI_TO_KIND[type] ?? 'like'
}

interface ReactionIconProps {
  /** The reaction type to render */
  type: ReactionKind | string
  /** Size in pixels */
  size?: number
  /** Additional className */
  className?: string
}

/**
 * Renders a reaction image from the shared reaction icon set.
 */
const ReactionIcon: React.FC<ReactionIconProps> = ({
  type,
  size = 24,
  className = '',
}) => {
  const config = REACTION_CONFIG[getReactionKind(type)]

  return (
    <span
      className={`inline-flex shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        filter: size >= 28 ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' : undefined,
      }}
    >
      <Image
        src={config.image}
        alt=""
        width={size}
        height={size}
        quality={100}
        className="h-full w-full object-contain"
      />
    </span>
  )
}

export default ReactionIcon
