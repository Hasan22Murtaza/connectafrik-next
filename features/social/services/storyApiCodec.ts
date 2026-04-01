import type { Story } from '@/features/social/types/story'

export const parseTextOverlay = (overlay: unknown): Record<string, unknown> | null => {
  if (!overlay) return null
  try {
    return typeof overlay === 'string' ? (JSON.parse(overlay) as Record<string, unknown>) : (overlay as Record<string, unknown>)
  } catch {
    return null
  }
}

export const normalizeGradientValue = (value: string | null | undefined): string | null => {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.startsWith('gradient:') ? trimmed.replace(/^gradient:/, '').trim() : trimmed
}

export const colorsFromGradientString = (value: string | null | undefined): [string, string] | null => {
  const normalized = normalizeGradientValue(value)
  if (!normalized) return null
  const parts = normalized.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null
  return [parts[0], parts[1]]
}

const getGradientColorsFromRow = (
  story: Record<string, unknown>,
  textOverlay: Record<string, unknown> | null
): [string, string] | null => {
  const rawGradient =
    (typeof story.background_gradient === 'string' && story.background_gradient.trim()
      ? (story.background_gradient as string)
      : null) ||
    (typeof story.media_url === 'string' && (story.media_url as string).startsWith('gradient:')
      ? (story.media_url as string)
      : null) ||
    (typeof textOverlay?.gradient === 'string' ? (textOverlay.gradient as string) : null)

  return colorsFromGradientString(rawGradient)
}

export type StoryProfilesApi = {
  full_name: string | null
  avatar_url: string | null
  username: string | null
}

/** One story for API: `stories` columns (no `text_overlay`) + `gradient_colors` + optional `text_color` + `profiles`. */
export function buildStoryApiRowFromDbRow(story: Record<string, unknown>): Record<string, unknown> {
  const profileData = story.profiles as { full_name?: string; avatar_url?: string; username?: string } | null | undefined
  const parsedOverlay = parseTextOverlay(story.text_overlay)
  const gradientPair = getGradientColorsFromRow(story, parsedOverlay)
  const isText = story.media_type === 'text'

  const row: Record<string, unknown> = {
    id: story.id,
    user_id: story.user_id,
    media_url: story.media_url ?? null,
    media_type: story.media_type,
    background_color: story.background_color ?? '#2563eb',
    caption: story.caption ?? null,
    music_url: story.music_url ?? null,
    music_title: story.music_title ?? null,
    music_artist: story.music_artist ?? null,
    is_highlight: Boolean(story.is_highlight),
    view_count: Number(story.view_count) || 0,
    expires_at: story.expires_at,
    created_at: story.created_at,
  }

  if (gradientPair) {
    row.gradient_colors = [gradientPair[0], gradientPair[1]]
  }
  if (isText && typeof parsedOverlay?.color === 'string' && (parsedOverlay.color as string).trim()) {
    row.text_color = (parsedOverlay.color as string).trim()
  }

  if (profileData !== undefined && profileData !== null) {
    row.profiles = {
      full_name: profileData.full_name ?? null,
      avatar_url: profileData.avatar_url ?? null,
      username: profileData.username ?? null,
    } satisfies StoryProfilesApi
  }

  if (story.has_viewed !== undefined || story.is_viewed !== undefined) {
    row.has_viewed = Boolean(story.has_viewed ?? story.is_viewed)
  }
  if (story.reaction_count !== undefined) row.reaction_count = Number(story.reaction_count) || 0
  if (story.reply_count !== undefined) row.reply_count = Number(story.reply_count) || 0
  if (story.user_reaction !== undefined) row.user_reaction = story.user_reaction

  return row
}

export type StoryGroupApi = {
  user_id: string
  profiles: StoryProfilesApi | null
  has_unviewed: boolean
  latest_story_at: string | null
  stories: Record<string, unknown>[]
}

export function groupRawStoriesToApiGroups(stories: Record<string, unknown>[]): StoryGroupApi[] {
  const grouped = new Map<string, Record<string, unknown>[]>()

  stories.forEach((story) => {
    if (!story?.id || !story?.user_id) return
    const uid = String(story.user_id)
    if (!grouped.has(uid)) grouped.set(uid, [])
    grouped.get(uid)!.push(story)
  })

  const groups: StoryGroupApi[] = []

  grouped.forEach((list) => {
    list.sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
    const first = list[0]
    const profiles = first.profiles as { full_name?: string; avatar_url?: string; username?: string } | null | undefined
    const apiStories = list.map(buildStoryApiRowFromDbRow)
    const hasUnviewed = apiStories.some((s) => !Boolean(s.has_viewed))

    groups.push({
      user_id: String(first.user_id),
      profiles: profiles
        ? {
            full_name: profiles.full_name ?? null,
            avatar_url: profiles.avatar_url ?? null,
            username: profiles.username ?? null,
          }
        : null,
      has_unviewed: hasUnviewed,
      latest_story_at: String(first.created_at || '') || null,
      stories: apiStories,
    })
  })

  groups.sort((a, b) => new Date(b.latest_story_at || 0).getTime() - new Date(a.latest_story_at || 0).getTime())
  return groups
}

function isCompactStory(raw: Record<string, unknown>): boolean {
  return typeof raw.i === 'string' && typeof raw.u === 'string'
}

function isDbAlignedStoryRow(raw: Record<string, unknown>): boolean {
  return typeof raw.id === 'string' && typeof raw.user_id === 'string'
}

function textOverlayToString(val: unknown): string | null {
  if (val == null) return null
  if (typeof val === 'string') return val
  try {
    return JSON.stringify(val)
  } catch {
    return null
  }
}

function pairFromGradientColorsField(raw: Record<string, unknown>): [string, string] | null {
  const gc = raw.gradient_colors ?? raw.g
  if (!Array.isArray(gc) || gc.length < 2) return null
  const a = String(gc[0]).trim()
  const b = String(gc[1]).trim()
  if (!a || !b) return null
  return [a, b]
}

function buildTextOverlayFromApiFields(raw: Record<string, unknown>, pair: [string, string] | null): string | null {
  if (raw.media_type !== 'text') return null
  const text = String(raw.caption || '').trim()
  if (!text) return null
  const color =
    typeof raw.text_color === 'string' && raw.text_color.trim() ? raw.text_color.trim() : '#FFFFFF'
  return JSON.stringify({
    text,
    color,
    fontSize: 24,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    backgroundColor: 'transparent',
    align: 'center',
    isBold: false,
    ...(pair ? { gradient: `${pair[0]},${pair[1]}` } : {}),
    x: 50,
    y: 50,
  })
}

/** Normalize API payload (DB-shaped row, legacy compact, or older flat keys) to app Story model */
export function denormalizeStoryFromApi(raw: Record<string, unknown>): Story {
  if (isDbAlignedStoryRow(raw)) {
    const profiles = raw.profiles as StoryProfilesApi | null | undefined
    const textOverlayStrLegacy = textOverlayToString(raw.text_overlay)
    const textOverlayParsed = parseTextOverlay(raw.text_overlay)
    const pairFromResponse = pairFromGradientColorsField(raw)
    const legacyG = getGradientColorsFromRow(raw, textOverlayParsed)
    const colors = pairFromResponse || legacyG
    const text_overlay =
      textOverlayStrLegacy || buildTextOverlayFromApiFields(raw, colors)

    return {
      id: String(raw.id),
      user_id: String(raw.user_id),
      user_name: profiles?.full_name || 'Unknown',
      user_avatar: profiles?.avatar_url || '',
      username: profiles?.username || '',
      profile_picture_url: profiles?.avatar_url || undefined,
      media_url: (raw.media_url as string | null) ?? null,
      media_type: raw.media_type as Story['media_type'],
      text_overlay,
      background_color: (raw.background_color as string) || '#2563eb',
      background_gradient: colors ? `${colors[0]},${colors[1]}` : ((raw.background_gradient as string) || null),
      background_gradient_colors:
        colors || (Array.isArray(raw.background_gradient_colors) ? (raw.background_gradient_colors as string[]) : null),
      caption: (raw.caption as string) || null,
      music_url: (raw.music_url as string) || null,
      music_title: (raw.music_title as string) || null,
      music_artist: (raw.music_artist as string) || null,
      is_highlight: Boolean(raw.is_highlight),
      view_count: Number(raw.view_count) || 0,
      expires_at: String(raw.expires_at || ''),
      created_at: String(raw.created_at || ''),
      has_viewed: Boolean(raw.has_viewed ?? raw.is_viewed),
      reaction_count: raw.reaction_count != null ? Number(raw.reaction_count) : undefined,
      reply_count: raw.reply_count != null ? Number(raw.reply_count) : undefined,
      user_reaction: (raw.user_reaction as string) || null,
    }
  }

  if (isCompactStory(raw)) {
    const g = raw.g as string[] | undefined
    const tx = typeof raw.tx === 'string' ? raw.tx : ''
    const tc = typeof raw.tc === 'string' ? raw.tc : '#FFFFFF'
    const text_overlay =
      tx !== ''
        ? JSON.stringify({
            text: tx,
            color: tc,
            fontSize: 24,
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            backgroundColor: 'transparent',
            align: 'center',
            isBold: false,
            ...(Array.isArray(g) && g.length >= 2 ? { gradient: `${g[0]},${g[1]}` } : {}),
            x: 50,
            y: 50,
          })
        : null

    return {
      id: raw.i as string,
      user_id: raw.u as string,
      user_name: (raw.n as string) || 'Unknown',
      user_avatar: (raw.av as string) || '',
      username: (raw.un as string) || '',
      profile_picture_url: (raw.pu as string) || (raw.av as string) || undefined,
      media_url: raw.mu != null ? (raw.mu as string | null) : null,
      media_type: raw.mt as Story['media_type'],
      text_overlay,
      background_color: (raw.bc as string) || '#2563eb',
      background_gradient: Array.isArray(g) && g.length >= 2 ? `${g[0]},${g[1]}` : null,
      background_gradient_colors: Array.isArray(g) && g.length >= 2 ? [g[0], g[1]] : null,
      caption: (raw.ca as string) || null,
      music_url: (raw.mq as string) || null,
      music_title: (raw.mqt as string) || null,
      music_artist: (raw.mqa as string) || null,
      is_highlight: Boolean(raw.ih),
      view_count: Number(raw.vc) || 0,
      expires_at: raw.ex as string,
      created_at: raw.cr as string,
      has_viewed: Boolean(raw.hv),
      reaction_count: raw.rc != null ? Number(raw.rc) : undefined,
      reply_count: raw.rpc != null ? Number(raw.rpc) : undefined,
      user_reaction: (raw.ur as string) || null,
    }
  }

  const textOverlay = parseTextOverlay(raw.text_overlay)
  const legacyG = getGradientColorsFromRow(raw, textOverlay)

  return {
    id: String(raw.id || raw.story_id || ''),
    user_id: String(raw.user_id || ''),
    user_name: (raw.user_name as string) || 'Unknown',
    user_avatar: (raw.user_avatar as string) || '',
    username: (raw.username as string) || '',
    profile_picture_url: (raw.profile_picture_url as string) || (raw.user_avatar as string) || undefined,
    media_url: (raw.media_url as string | null) ?? null,
    media_type: raw.media_type as Story['media_type'],
    text_overlay: (raw.text_overlay as string) || null,
    background_color: (raw.background_color as string) || '#2563eb',
    background_gradient: legacyG ? `${legacyG[0]},${legacyG[1]}` : ((raw.background_gradient as string) || null),
    background_gradient_colors: legacyG || (Array.isArray(raw.background_gradient_colors) ? (raw.background_gradient_colors as string[]) : null),
    caption: (raw.caption as string) || null,
    music_url: (raw.music_url as string) || null,
    music_title: (raw.music_title as string) || null,
    music_artist: (raw.music_artist as string) || null,
    is_highlight: Boolean(raw.is_highlight),
    view_count: Number(raw.view_count) || 0,
    expires_at: String(raw.expires_at || ''),
    created_at: String(raw.created_at || ''),
    has_viewed: Boolean(raw.has_viewed),
    reaction_count: raw.reaction_count != null ? Number(raw.reaction_count) : undefined,
    reply_count: raw.reply_count != null ? Number(raw.reply_count) : undefined,
    user_reaction: (raw.user_reaction as string) || null,
  }
}

export function flattenStoryFeedItems(items: Record<string, unknown>[]): Record<string, unknown>[] {
  if (!Array.isArray(items) || items.length === 0) return []
  const first = items[0]
  const nested = (first.stories as unknown[]) || (first.s as unknown[])
  if (Array.isArray(nested)) {
    return items.flatMap((group) => {
      const stories = (group.stories as Record<string, unknown>[]) || (group.s as Record<string, unknown>[]) || []
      return stories
    })
  }
  return items as Record<string, unknown>[]
}
