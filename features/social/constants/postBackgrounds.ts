export type PostBackgroundPreset = {
  id: string
  label: string
  /** CSS `background` value */
  css: string
  /** Text + placeholder on top of the background */
  textClass: string
  placeholderClass: string
}

/** Curated presets for composer + feed (ids are stored in `posts.background_id`). */
export const POST_BACKGROUND_PRESETS: PostBackgroundPreset[] = [
  { id: 'purple-dream', label: 'Purple dream', css: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', textClass: 'text-white', placeholderClass: 'placeholder-white/60' },
  { id: 'pink-blush', label: 'Pink blush', css: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', textClass: 'text-white', placeholderClass: 'placeholder-white/60' },
  { id: 'ocean', label: 'Ocean', css: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', textClass: 'text-white', placeholderClass: 'placeholder-white/60' },
  { id: 'mint', label: 'Mint', css: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', textClass: 'text-gray-900', placeholderClass: 'placeholder-gray-500' },
  { id: 'sunrise', label: 'Sunrise', css: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', textClass: 'text-gray-900', placeholderClass: 'placeholder-gray-600' },
  { id: 'deep-teal', label: 'Deep teal', css: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', textClass: 'text-white', placeholderClass: 'placeholder-white/60' },
  { id: 'soft-pastel', label: 'Soft pastel', css: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', textClass: 'text-gray-900', placeholderClass: 'placeholder-gray-500' },
  { id: 'coral', label: 'Coral', css: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', textClass: 'text-gray-900', placeholderClass: 'placeholder-gray-600' },
  { id: 'peach', label: 'Peach', css: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', textClass: 'text-gray-900', placeholderClass: 'placeholder-gray-600' },
  { id: 'ember', label: 'Ember', css: 'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)', textClass: 'text-gray-900', placeholderClass: 'placeholder-gray-600' },
  { id: 'solid-ink', label: 'Ink', css: '#111827', textClass: 'text-white', placeholderClass: 'placeholder-white/55' },
  { id: 'solid-ruby', label: 'Ruby', css: '#be123c', textClass: 'text-white', placeholderClass: 'placeholder-white/60' },
  { id: 'solid-violet', label: 'Violet', css: '#6d28d9', textClass: 'text-white', placeholderClass: 'placeholder-white/60' },
  { id: 'solid-sand', label: 'Sand', css: '#fef3c7', textClass: 'text-gray-900', placeholderClass: 'placeholder-gray-600' },
  { id: 'charcoal', label: 'Charcoal', css: 'linear-gradient(145deg, #1f2937 0%, #0f172a 100%)', textClass: 'text-white', placeholderClass: 'placeholder-white/55' },
  { id: 'sunset-stripes', label: 'Sunset', css: 'linear-gradient(120deg, #f59e0b 0%, #ec4899 40%, #8b5cf6 100%)', textClass: 'text-white', placeholderClass: 'placeholder-white/60' },
  { id: 'img-kente', label: 'Kente', css: "linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url('/assets/images/post-bg/kente.jpg') center/cover no-repeat", textClass: 'text-white', placeholderClass: 'placeholder-white/70' },
]

const PRESET_BY_ID = new Map(POST_BACKGROUND_PRESETS.map((p) => [p.id, p]))

/** Gradients for legacy short text-only posts with no `background_id` (hash of post id). */
export const LEGACY_SHORT_POST_BACKGROUNDS: string[] = POST_BACKGROUND_PRESETS.map((p) => p.css)

export function getPostBackgroundPreset(id: string | null | undefined): PostBackgroundPreset | null {
  if (!id) return null
  return PRESET_BY_ID.get(id) ?? null
}

export function sanitizePostBackgroundId(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw !== 'string') return null
  return PRESET_BY_ID.has(raw) ? raw : null
}

export function legacyGradientForPostId(postId: string): string {
  const hash = postId.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0)
  const index = Math.abs(hash) % LEGACY_SHORT_POST_BACKGROUNDS.length
  return LEGACY_SHORT_POST_BACKGROUNDS[index]!
}
