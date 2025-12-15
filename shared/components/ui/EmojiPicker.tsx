
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Smile, Heart, ThumbsUp, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
  onClose: () => void
  isOpen: boolean
  variant?: 'full' | 'compact'
}

type EmojiCategoryKey = 'reactions' | 'faces' | 'gestures' | 'objects'

const COMPACT_EMOJIS: string[] = [
  '\u{1F44D}', // thumbs up
  '\u{1F525}', // fire
  '\u{1F389}', // party popper
  '\u{1F929}', // starry eyed
  '\u{1F60D}', // heart eyes
  '\u{1F44F}', // clapping
  '\u{1F62E}\u{200D}\u{1F4A8}', // wow
  '\u{1F602}', // tears of joy
  '\u{1F607}', // halo
  '\u{2764}\u{FE0F}', // red heart
  '\u{1F60E}', // cool
  '\u{1F973}' // party face
]

const EMOJI_CATEGORIES: Record<EmojiCategoryKey, { name: string; icon: LucideIcon; emojis: string[] }> = {
  reactions: {
    name: 'Quick Reactions',
    icon: Heart,
    emojis: [
      '\u{1F44D}',
      '\u{1F44F}',
      '\u{1F64C}',
      '\u{1F44C}',
      '\u{1F49A}',
      '\u{1F525}',
      '\u{1F389}',
      '\u{1F618}',
      '\u{1F62E}\u{200D}\u{1F4A8}',
      '\u{1F60D}',
      '\u{1F602}',
      '\u{1F60A}'
    ]
  },
  faces: {
    name: 'Faces & Smiles',
    icon: Smile,
    emojis: [
      '\u{1F600}',
      '\u{1F603}',
      '\u{1F604}',
      '\u{1F60A}',
      '\u{1F60E}',
      '\u{1F609}',
      '\u{1F60B}',
      '\u{1F62C}',
      '\u{1F601}',
      '\u{1F924}',
      '\u{1F60F}',
      '\u{1F62D}',
      '\u{1F922}',
      '\u{1F62A}',
      '\u{1F634}'
    ]
  },
  gestures: {
    name: 'Gestures & Actions',
    icon: ThumbsUp,
    emojis: [
      '\u{1F44B}',
      '\u{1F91A}',
      '\u{1F590}\u{FE0F}',
      '\u{1F596}',
      '\u{270C}\u{FE0F}',
      '\u{1F918}',
      '\u{1F919}',
      '\u{1F91E}',
      '\u{1F44F}',
      '\u{1F450}',
      '\u{1F44A}',
      '\u{270A}',
      '\u{1F44C}',
      '\u{1F64F}'
    ]
  },
  objects: {
    name: 'Objects & Symbols',
    icon: Star,
    emojis: [
      '\u{1F680}',
      '\u{1F4AF}',
      '\u{2728}',
      '\u{1F48E}',
      '\u{1F4A1}',
      '\u{1F4AA}',
      '\u{1F4A3}',
      '\u{1F30C}',
      '\u{1F31F}',
      '\u{1F697}',
      '\u{1F3C6}',
      '\u{1F381}',
      '\u{1F3AE}',
      '\u{1F3B8}'
    ]
  }
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, onClose, isOpen, variant = 'full' }) => {
  const pickerRef = useRef<HTMLDivElement>(null)
  const [activeCategory, setActiveCategory] = useState<EmojiCategoryKey>('reactions')

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) {
      setActiveCategory('reactions')
    }
  }, [isOpen])

  const compactEmojiList = useMemo(() => COMPACT_EMOJIS, [])
  const currentEmojis = useMemo(() => EMOJI_CATEGORIES[activeCategory].emojis, [activeCategory])

  if (!isOpen) return null

  if (variant === 'compact') {
    return (
      <div
        ref={pickerRef}
        className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500">Quick reactions</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            close
          </button>
        </div>
        <div className="flex max-w-full items-center gap-1 overflow-x-auto">
          {compactEmojiList.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onEmojiSelect(emoji)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-xl transition hover:bg-gray-100"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const CategoryIcon = EMOJI_CATEGORIES[activeCategory].icon

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full left-0 z-50 mb-3 w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <CategoryIcon className="h-4 w-4" />
          <span>{EMOJI_CATEGORIES[activeCategory].name}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs uppercase tracking-wide text-gray-400 transition hover:text-gray-600"
        >
          close
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(EMOJI_CATEGORIES) as EmojiCategoryKey[]).map((key) => {
          const { name, icon: Icon } = EMOJI_CATEGORIES[key]
          const isActive = key === activeCategory
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs transition ${
                isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{name}</span>
            </button>
          )
        })}
      </div>

      <div className="grid max-h-48 grid-cols-8 gap-2 overflow-y-auto">
        {currentEmojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onEmojiSelect(emoji)}
            className="flex h-8 w-8 items-center justify-center rounded text-lg transition hover:bg-gray-100 hover:scale-110"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}

export default EmojiPicker
