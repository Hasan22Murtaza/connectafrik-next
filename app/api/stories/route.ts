import { NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  buildStoryApiRowFromDbRow,
  colorsFromGradientString,
  groupRawStoriesToApiGroups,
} from '@/features/social/services/storyApiCodec'

const STORY_SELECT = `
  id, user_id, media_url, media_type, text_overlay, background_color,
  caption, music_url, music_title, music_artist, is_highlight,
  view_count, expires_at, created_at,
  profiles!stories_user_id_fkey ( full_name, avatar_url, username )
`

function pickTrimmedString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t || undefined
}

/** Accept same names as API response; short aliases (t, tc, bc, mu, mt, …) still supported */
function mergeCreateStoryBody(body: Record<string, unknown>) {
  const captionUnified =
    pickTrimmedString(body.caption) ??
    pickTrimmedString(body.ca) ??
    pickTrimmedString(body.t) ??
    pickTrimmedString(body.text)

  const text = captionUnified
  const text_color = pickTrimmedString(body.text_color) ?? pickTrimmedString(body.tc)
  const background_color = pickTrimmedString(body.background_color) ?? pickTrimmedString(body.bc)

  const media_url = (body.media_url !== undefined ? body.media_url : body.mu) as string | null | undefined
  const media_type = (body.media_type as string) || (body.mt as string)
  const caption = captionUnified

  const music_url = (body.music_url !== undefined ? body.music_url : body.mq) as string | undefined
  const music_title = pickTrimmedString(body.music_title) ?? pickTrimmedString(body.mqt)
  const music_artist = pickTrimmedString(body.music_artist) ?? pickTrimmedString(body.mqa)
  const text_overlay = body.text_overlay as string | undefined
  const is_highlight = Boolean(body.is_highlight ?? body.ih)

  const gradient_colors = body.gradient_colors as unknown
  const g = body.g as unknown
  let background_gradient = typeof body.background_gradient === 'string' ? body.background_gradient.trim() : ''
  if (!background_gradient) {
    const arr = Array.isArray(gradient_colors)
      ? gradient_colors
      : Array.isArray(g)
        ? g
        : null
    if (arr && arr.length >= 2) {
      background_gradient = `${String(arr[0]).trim()},${String(arr[1]).trim()}`
    }
  }
  if (!background_gradient) background_gradient = ''

  return {
    text,
    text_color,
    background_color,
    media_url,
    media_type,
    caption,
    music_url,
    music_title,
    music_artist,
    text_overlay,
    is_highlight,
    background_gradient: background_gradient || null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('userId')
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '5', 10) || 5, 1), 50)
    const from = page * limit
    const to = from + limit

    if (targetUserId) {
      const { data, error } = await supabase
        .from('stories')
        .select(STORY_SELECT)
        .eq('user_id', targetUserId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .range(from, to - 1)

      if (error) return errorResponse(error.message, 400)

      const stories = (data || []).map((row) => buildStoryApiRowFromDbRow(row as Record<string, unknown>))
      return jsonResponse({
        data: stories,
        page,
        pageSize: limit,
        hasMore: stories.length === limit,
      })
    }

    // Stories from people you follow (not yourself — /api/stories/mine covers yours).
    // Uses service role so RLS cannot block reads; scoped to following_ids only.
    let service
    try {
      service = createServiceClient()
    } catch {
      return errorResponse('Server misconfigured: SUPABASE_SERVICE_ROLE_KEY required for story feed', 500)
    }

    const { data: followsRows, error: followsErr } = await service
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    if (followsErr) return errorResponse(followsErr.message, 400)

    const followingIds = [
      ...new Set((followsRows ?? []).map((r: { following_id: string }) => r.following_id).filter(Boolean)),
    ]

    if (followingIds.length === 0) {
      return jsonResponse({
        data: [],
        page,
        pageSize: limit,
        hasMore: false,
      })
    }

    const STORY_IN_CHUNK = 100
    const allRows: Record<string, unknown>[] = []
    for (let i = 0; i < followingIds.length; i += STORY_IN_CHUNK) {
      const chunk = followingIds.slice(i, i + STORY_IN_CHUNK)
      const { data: chunkData, error: chunkErr } = await service
        .from('stories')
        .select(STORY_SELECT)
        .in('user_id', chunk)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (chunkErr) return errorResponse(chunkErr.message, 400)
      allRows.push(...((chunkData || []) as Record<string, unknown>[]))
    }

    allRows.sort(
      (a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime()
    )
    const capped = allRows.slice(0, 500)

    if (capped.length > 0) {
      const ids = capped.map((r) => r.id as string).filter(Boolean)
      const viewChunks: string[][] = []
      for (let i = 0; i < ids.length; i += STORY_IN_CHUNK) viewChunks.push(ids.slice(i, i + STORY_IN_CHUNK))

      const viewedIds = new Set<string>()
      for (const idChunk of viewChunks) {
        const { data: viewRows } = await service
          .from('story_views')
          .select('story_id')
          .eq('viewer_id', user.id)
          .in('story_id', idChunk)
        for (const v of viewRows ?? []) {
          viewedIds.add((v as { story_id: string }).story_id)
        }
      }
      capped.forEach((row) => {
        row.has_viewed = viewedIds.has(row.id as string)
      })
    }

    const groupedStories = groupRawStoriesToApiGroups(capped)
    const paged = groupedStories.slice(from, to)
    return jsonResponse({
      data: paged,
      page,
      pageSize: limit,
      hasMore: groupedStories.length > to,
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to fetch stories', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = (await request.json()) as Record<string, unknown>
    const merged = mergeCreateStoryBody(body)

    const {
      media_url,
      media_type,
      caption,
      music_url,
      music_title,
      music_artist,
      text_overlay,
      text,
      text_color,
      background_color,
      background_gradient,
      is_highlight,
    } = merged

    const sanitizedMediaUrl = typeof media_url === 'string' && media_url.trim() ? media_url.trim() : null
    const sanitizedText = typeof text === 'string' ? text.trim() : ''
    const sanitizedTextColor = typeof text_color === 'string' && text_color.trim() ? text_color : '#FFFFFF'
    const sanitizedBackgroundGradient =
      typeof background_gradient === 'string' && background_gradient.trim()
        ? background_gradient.trim()
        : null

    const isGradientMediaUrl = typeof sanitizedMediaUrl === 'string' && sanitizedMediaUrl.startsWith('gradient:')
    /** Real image/video URL — caption alone must not force text-story mode or media_url is cleared on insert */
    const hasRealMedia = Boolean(sanitizedMediaUrl && !isGradientMediaUrl)
    const isTextStory =
      !hasRealMedia &&
      (Boolean(sanitizedText) || Boolean(sanitizedBackgroundGradient) || isGradientMediaUrl)
    const normalizedMediaType =
      media_type === 'image' || media_type === 'video'
        ? media_type
        : isTextStory
          ? 'text'
          : null

    if (!isTextStory && !sanitizedMediaUrl) {
      return errorResponse('media_url is required', 400)
    }
    if (!normalizedMediaType) {
      return errorResponse('media_type is required', 400)
    }

    const sanitizedBackgroundColor =
      typeof background_color === 'string' && background_color.trim()
        ? background_color
        : isTextStory
          ? '#2563eb'
          : '#000000'
    const gradientFromMediaUrl = isGradientMediaUrl
      ? sanitizedMediaUrl.replace(/^gradient:/, '').trim()
      : null
    const normalizedGradient =
      sanitizedBackgroundGradient || gradientFromMediaUrl || `${sanitizedBackgroundColor},#1d4ed8`
    const parsedGradient = colorsFromGradientString(normalizedGradient)

    if (isTextStory && !sanitizedText) {
      return errorResponse('text is required for text stories', 400)
    }

    const normalizedTextOverlay = isTextStory
      ? JSON.stringify({
          text: sanitizedText,
          color: sanitizedTextColor,
          fontSize: 24,
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          backgroundColor: 'transparent',
          align: 'center',
          isBold: false,
          gradient: parsedGradient ? `${parsedGradient[0]},${parsedGradient[1]}` : normalizedGradient,
          x: 50,
          y: 50,
        })
      : text_overlay || null

    const { data, error } = await supabase
      .from('stories')
      .insert({
        user_id: user.id,
        media_url: isTextStory ? null : sanitizedMediaUrl,
        media_type: normalizedMediaType,
        caption: isTextStory ? sanitizedText : caption || null,
        music_url: isTextStory ? null : music_url || null,
        music_title: isTextStory ? null : music_title || null,
        music_artist: isTextStory ? null : music_artist || null,
        text_overlay: normalizedTextOverlay,
        background_color: sanitizedBackgroundColor,
        is_highlight: is_highlight || false,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select(STORY_SELECT)
      .single()

    if (error) return errorResponse(error.message, 400)

    const story = buildStoryApiRowFromDbRow(data as Record<string, unknown>)

    return jsonResponse({ data: story }, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to create story', 500)
  }
}
