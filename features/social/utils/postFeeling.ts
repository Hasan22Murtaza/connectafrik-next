export interface PostFeeling {
  emoji: string
  label: string
}

const MAX_LABEL = 40
const MAX_EMOJI = 8

/** Normalize API/UI feeling payloads; returns null when empty or invalid. */
export function sanitizePostFeeling(raw: unknown): PostFeeling | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'string') {
    const label = raw.trim().slice(0, MAX_LABEL)
    if (!label) return null
    return { emoji: '😊', label }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const label = typeof obj.label === 'string' ? obj.label.trim().slice(0, MAX_LABEL) : ''
  if (!label) return null
  const emojiRaw = typeof obj.emoji === 'string' ? obj.emoji.trim().slice(0, MAX_EMOJI) : ''
  return { emoji: emojiRaw || '😊', label }
}

export function formatFeelingPhrase(feeling: PostFeeling): string {
  return `feeling ${feeling.label} ${feeling.emoji}`
}
