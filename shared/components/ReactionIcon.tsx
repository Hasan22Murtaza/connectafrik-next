'use client'

import React from 'react'
import { AiFillLike } from 'react-icons/ai'
import { FaHeart } from 'react-icons/fa'

export type ReactionKind = 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry' | 'care'

interface ReactionConfig {
  /** 'icon' = SVG icon on gradient circle, 'emoji' = native emoji face (no bg needed) */
  mode: 'icon' | 'emoji'
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  emoji?: string
  gradient: string
  iconColor: string
  label: string
  hoverBg: string
}

/** Central config for every reaction type */
export const REACTION_CONFIG: Record<ReactionKind, ReactionConfig> = {
  like: {
    mode: 'icon',
    icon: AiFillLike,
    gradient: 'linear-gradient(180deg, #18afff 0%, #0062df 100%)',
    iconColor: '#ffffff',
    label: 'Like',
    hoverBg: 'hover:bg-blue-50',
  },
  love: {
    mode: 'icon',
    icon: FaHeart,
    gradient: 'linear-gradient(180deg, #ff6680 0%, #e6033a 100%)',
    iconColor: '#ffffff',
    label: 'Love',
    hoverBg: 'hover:bg-red-50',
  },
  laugh: {
    mode: 'emoji',
    emoji: '🤣',
    gradient: '#f7b125',
    iconColor: '',
    label: 'Haha',
    hoverBg: 'hover:bg-yellow-50',
  },
  wow: {
    mode: 'emoji',
    emoji: '😮',
    gradient: '#f7b125',
    iconColor: '',
    label: 'Wow',
    hoverBg: 'hover:bg-yellow-50',
  },
  sad: {
    mode: 'emoji',
    emoji: '😢',
    gradient: '#f7b125',
    iconColor: '',
    label: 'Sad',
    hoverBg: 'hover:bg-yellow-50',
  },
  angry: {
    mode: 'emoji',
    emoji: '😡',
    gradient: '#e9710f',
    iconColor: '',
    label: 'Angry',
    hoverBg: 'hover:bg-orange-50',
  },
  care: {
    mode: 'emoji',
    emoji: '🤗',
    gradient: '#f7b125',
    iconColor: '',
    label: 'Care',
    hoverBg: 'hover:bg-yellow-50',
  },
}

/** Order of reactions shown in the hover picker */
export const PICKER_REACTIONS: ReactionKind[] = ['like', 'love', 'laugh', 'wow', 'sad', 'angry']

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
 * Renders a polished Facebook-style reaction icon.
 * - Like & Love: SVG icon on gradient circle
 * - Face reactions: native emoji rendered large (the face IS the circle)
 */
const ReactionIcon: React.FC<ReactionIconProps> = ({
  type,
  size = 24,
  className = '',
}) => {
  const config = REACTION_CONFIG[type as ReactionKind] || REACTION_CONFIG.like

  // SVG icon mode (Like, Love) — icon on gradient circle
  if (config.mode === 'icon' && config.icon) {
    const IconComponent = config.icon
    const iconSize = size * 0.55
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full shrink-0 shadow-sm ${className}`}
        style={{
          width: size,
          height: size,
          background: config.gradient,
        }}
      >
        <IconComponent
          style={{ width: iconSize, height: iconSize, color: config.iconColor }}
        />
      </span>
    )
  }

  // Emoji mode (Haha, Wow, Sad, Angry, Care) — native emoji fills the space
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 select-none leading-none ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.92,
      }}
    >
      {config.emoji}
    </span>
  )
}

export default ReactionIcon
