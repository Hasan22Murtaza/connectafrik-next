'use client'

import React, { useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { AlignCenter, AlignLeft, AlignRight, ALargeSmall, Palette, Smile } from 'lucide-react'
import { createStory } from '@/features/social/services/storiesService'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'react-hot-toast'

const StoryEmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })

const TEXT_STORY_BACKGROUND_COLORS = [
  '#FFFFFF',
  '#F97316',
  '#3B82F6',
  '#7C3AED',
  '#E11D48',
  '#059669',
  '#111827',
  '#F59E0B',
  '#F1F5F9',
  '#FB7185',
  '#0891B2',
  '#5B21B6',
  '#065F46',
] as const

const TEXT_STORY_TEXT_COLORS = ['#FFFFFF', '#111827', '#FDE047', '#FB7185', '#34D399', '#38BDF8'] as const
const MAX_TEXT_STORY_LENGTH = 250

interface TextStoryEditorProps {
  onPostingChange: (isPosting: boolean) => void
}

const TextStoryEditor: React.FC<TextStoryEditorProps> = ({ onPostingChange }) => {
  const router = useRouter()
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF')
  const [textColor, setTextColor] = useState('#111827')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isPosting, setIsPosting] = useState(false)

  const userName = typeof user?.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name.trim() || 'You'
    : 'You'
  const userAvatar = typeof user?.user_metadata?.avatar_url === 'string'
    ? user.user_metadata.avatar_url
    : ''

  const insertEmoji = useCallback((emoji: string) => {
    setText((current) => `${current}${emoji}`.slice(0, MAX_TEXT_STORY_LENGTH))
    setShowEmojiPicker(false)
  }, [])

  const handlePost = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const storyText = text.trim()
    if (!storyText || isPosting) return
    if (!user) {
      toast.error('Please sign in to create a story')
      return
    }

    setIsPosting(true)
    onPostingChange(true)
    try {
      const createdStory = await createStory({
        caption: storyText,
        text: storyText,
        media_type: 'text',
        background_color: backgroundColor,
        text_color: textColor,
        text_overlay: JSON.stringify({
          text: storyText,
          fontSize: 24,
          color: textColor,
          backgroundColor: 'transparent',
          x: 50,
          y: 50,
        }),
      })
      window.dispatchEvent(new CustomEvent('story-created', { detail: createdStory }))
      toast.success('Story created successfully')
      router.push('/feed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create story')
    } finally {
      setIsPosting(false)
      onPostingChange(false)
    }
  }, [backgroundColor, isPosting, onPostingChange, router, text, textColor, user])

  return (
    <div className="flex flex-col lg:contents">
      <form
        id="text-story-form"
        onSubmit={handlePost}
        className="order-2 flex max-h-[45vh] flex-1 flex-col border-t border-border bg-white lg:col-start-1 lg:row-start-2 lg:order-none lg:min-h-0 lg:max-h-none lg:w-full"
      >
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:space-y-6 sm:p-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="text-story-content" className="text-[10px] font-semibold uppercase tracking-wide text-content">
                Text
              </label>
              <span className="text-[9px] text-content-secondary">{text.length}/{MAX_TEXT_STORY_LENGTH}</span>
            </div>
            <div className="overflow-visible rounded-xl border border-border bg-white">
              <textarea
                id="text-story-content"
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT_STORY_LENGTH))}
                placeholder="What would you like to share?"
                maxLength={MAX_TEXT_STORY_LENGTH}
                required
                className="h-24 w-full resize-none rounded-t-xl px-3 py-2.5 text-xs text-content placeholder:text-content-tertiary focus:outline-none sm:h-28"
              />
              <div className="flex items-center justify-between border-t border-slate-100 px-2 py-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((shown) => !shown)}
                    aria-expanded={showEmojiPicker}
                    className="flex items-center gap-1 rounded px-1.5 py-1 text-[9px] font-medium text-content-secondary transition hover:bg-surface-hover hover:text-content"
                  >
                    <Smile className="h-3 w-3" />
                    Add emoji
                  </button>
                </div>
                {/* <div className="flex items-center rounded-md bg-surface-secondary p-0.5">
                  {([
                    ['left', AlignLeft],
                    ['center', AlignCenter],
                    ['right', AlignRight],
                  ] as const).map(([alignment, Icon]) => (
                    <button
                      key={alignment}
                      type="button"
                      aria-label={`Align ${alignment}`}
                      aria-pressed={textAlignment === alignment}
                      onClick={() => setTextAlignment(alignment)}
                      className={`rounded p-1 transition ${
                        textAlignment === alignment ? 'bg-white text-content shadow-sm' : 'text-content-secondary hover:text-content'
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                    </button>
                  ))}
                </div> */}
              </div>
            </div>
            {showEmojiPicker && (
              <div className="relative z-30 mt-2 overflow-hidden rounded-xl border border-border shadow-lg">
                <StoryEmojiPicker
                  onEmojiClick={(emojiData) => insertEmoji(emojiData.emoji)}
                  width="100%"
                  height={280}
                  searchDisabled
                  skinTonesDisabled
                  previewConfig={{ showPreview: false }}
                  lazyLoadEmojis
                />
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-content">
              <Palette className="h-4 w-4" />
              Background
            </h3>
            <div className="grid grid-cols-7 gap-2">
              {TEXT_STORY_BACKGROUND_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use ${color} background`}
                  aria-pressed={backgroundColor === color}
                  onClick={() => setBackgroundColor(color)}
                  className={`h-7 w-7 rounded-full border transition hover:scale-110 ${
                    backgroundColor === color ? 'border-white ring-2 ring-[#F97316]' : 'border-slate-200'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <label
                title="Choose custom background color"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-slate-300 text-sm text-content-secondary transition hover:border-primary-500 hover:text-primary-600"
              >
                +
                <input
                  type="color"
                  aria-label="Choose custom background color"
                  value={backgroundColor}
                  onChange={(event) => setBackgroundColor(event.target.value)}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-content">
              <ALargeSmall className="h-3.5 w-3.5" />
              Text color
            </h3>
            <div className="flex flex-wrap gap-2">
              {TEXT_STORY_TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use ${color} text`}
                  aria-pressed={textColor === color}
                  onClick={() => setTextColor(color)}
                  className={`h-7 w-7 rounded-full border transition hover:scale-110 ${
                    textColor === color ? 'border-white ring-2 ring-[#F97316]' : 'border-slate-200'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 px-4 py-2.5 sm:px-5">
          <p className="text-center text-[9px] text-content-secondary">Your text story will be visible for 24 hours</p>
        </div>
      </form>

      <div className="order-1 flex min-h-[55vh] flex-1 items-center justify-center bg-transparent p-4 sm:p-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:order-none lg:min-h-0 ">
        <div className="relative">
          <div className="h-[356px] w-[200px] rounded-[2rem] bg-gray-900 p-[4px] shadow-2xl sm:h-[498px] sm:w-[280px] sm:rounded-[2.5rem] sm:p-[5px] lg:h-[534px] lg:w-[300px] lg:rounded-[3rem] lg:p-[6px]">
            <div className="relative h-full w-full overflow-hidden rounded-[1.75rem] bg-slate-950 sm:rounded-[2.25rem] lg:rounded-[2.5rem]">
              <div className="absolute left-1/2 top-0 z-30 flex h-5 w-20 -translate-x-1/2 items-center justify-center rounded-b-2xl bg-black sm:h-6 sm:w-24 sm:rounded-b-3xl lg:h-7 lg:w-28">
                <span className="h-1.5 w-8 rounded-full bg-slate-800" />
              </div>
              <div className="absolute left-3 right-3 top-2 z-20 flex gap-1 sm:left-4 sm:right-4 sm:top-3">
                <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-surface/40 sm:h-[3px]">
                  <div className="h-full w-1/2 bg-surface" />
                </div>
              </div>

              <div className="absolute left-3 right-3 top-7 z-20 flex items-center justify-between sm:left-4 sm:right-4 sm:top-9 sm:gap-2.5 lg:top-10">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary-500 to-primary-600 ring-2 ring-white/30 sm:h-8 sm:w-8 lg:h-9 lg:w-9">
                    {userAvatar ? (
                      <img src={userAvatar} alt={userName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold text-white sm:text-sm">{userName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white drop-shadow sm:text-sm">{userName}</p>
                    <p className="text-[9px] text-white/70 drop-shadow sm:text-[10px]">ConnectAfrik Member</p>
                  </div>
                </div>
                <button type="button" aria-label="Close preview" className="text-white/60">
                  <span aria-hidden="true" className="text-sm">×</span>
                </button>
              </div>

              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/60 to-transparent" />
              <div
                className="absolute inset-0 flex items-center justify-center overflow-y-auto px-6 pb-16 pt-20"
                style={{ backgroundColor, color: textColor }}
              >
                <p
                  className="max-h-full w-full break-words whitespace-pre-wrap text-lg font-semibold leading-relaxed sm:text-2xl"
                >
                  {text || <span className="opacity-50">Your text story will appear here</span>}
                </p>
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-1.5 sm:bottom-4 sm:left-4 sm:right-4">
                <div className="flex h-7 min-w-0 flex-1 items-center justify-between rounded-full bg-white/20 px-3 text-[9px] text-white/70">
                  <span>Send message...</span>
                  <span aria-hidden="true">→</span>
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs text-rose-400">♥</div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs text-white">↗</div>
              </div>
            </div>
          </div>
          <div className="absolute -inset-8 -z-10 hidden rounded-[4rem] bg-primary-400/10 blur-2xl lg:block" />
        </div>
      </div>
    </div>
  )
}

export default TextStoryEditor
