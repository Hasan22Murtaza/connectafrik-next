export interface PostFeelingPreset {
  id: string
  label: string
  emoji: string
}

/** Built-in feelings for the create-post picker (Facebook-style). */
export const POST_FEELING_PRESETS: PostFeelingPreset[] = [
  { id: 'happy', label: 'Happy', emoji: '😊' },
  { id: 'blessed', label: 'Blessed', emoji: '🙏' },
  { id: 'inspired', label: 'Inspired', emoji: '✨' },
  { id: 'excited', label: 'Excited', emoji: '🎉' },
  { id: 'grateful', label: 'Grateful', emoji: '🥰' },
  { id: 'loved', label: 'Loved', emoji: '❤️' },
  { id: 'motivated', label: 'Motivated', emoji: '💪' },
  { id: 'relaxed', label: 'Relaxed', emoji: '😌' },
  { id: 'sad', label: 'Sad', emoji: '😢' },
  { id: 'tired', label: 'Tired', emoji: '😴' },
  { id: 'angry', label: 'Angry', emoji: '😠' },
  { id: 'confused', label: 'Confused', emoji: '😕' },
  { id: 'proud', label: 'Proud', emoji: '😎' },
  { id: 'hopeful', label: 'Hopeful', emoji: '🌟' },
  { id: 'lonely', label: 'Lonely', emoji: '🥺' },
  { id: 'sick', label: 'Sick', emoji: '🤒' },
]

export function feelingSubtitle(label: string, emoji: string): string {
  return `Feeling ${label} ${emoji}`
}
