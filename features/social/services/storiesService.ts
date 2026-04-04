import { apiClient } from '@/lib/api-client'
import {
  denormalizeStoryFromApi,
  flattenStoryFeedItems,
} from '@/features/social/services/storyApiCodec'
import type { Story } from '@/features/social/types/story'

export type { Story } from '@/features/social/types/story'

/** POST /api/stories — prefer same field names as GET/POST story response */
export interface CreateStoryData {
  caption?: string
  text_color?: string
  background_color?: string
  gradient_colors?: [string, string]
  media_url?: string | null
  media_type?: 'image' | 'video' | 'text'
  music_url?: string
  music_title?: string
  music_artist?: string
  is_highlight?: boolean
  /** @deprecated use caption */
  t?: string
  /** @deprecated use gradient_colors */
  g?: [string, string]
  /** @deprecated use media_url */
  mu?: string | null
  /** @deprecated use media_type */
  mt?: 'image' | 'video' | 'text'
  /** @deprecated use text_color */
  tc?: string
  /** @deprecated use background_color */
  bc?: string
  /** @deprecated use caption */
  ca?: string
  text?: string
  background_gradient?: string
  text_overlay?: string
}

export interface TextOverlay {
  text: string
  fontSize: number
  fontFamily: string
  color: string
  backgroundColor: string
  align: 'left' | 'center' | 'right'
  x: number
  y: number
  isBold?: boolean
}

export interface StoryView {
  id: string
  story_id: string
  viewer_id: string
  viewed_at: string
  viewer_name?: string
  viewer_avatar?: string
}

export interface StoryReaction {
  id: string
  story_id: string
  user_id: string
  reaction_type: string
  created_at: string
  user_name?: string
  user_avatar?: string
}

export interface StoryReply {
  id: string
  story_id: string
  author_id: string
  content: string
  created_at: string
  author_name?: string
  author_avatar?: string
}

interface ListResponse<T> {
  data: T[]
  hasMore?: boolean
}

interface SingleResponse<T> {
  data: T
}

interface StoryGroupResponse {
  user_id: string
  u?: string
  username?: string
  user_name?: string
  user_avatar?: string
  profile_picture_url?: string
  has_unviewed?: boolean
  hu?: boolean
  stories?: Story[]
  s?: Record<string, unknown>[]
}

const flattenStoryData = (items: Array<Story | StoryGroupResponse | Record<string, unknown>>): Story[] => {
  const raw = items as Record<string, unknown>[]
  return flattenStoryFeedItems(raw).map((row) => denormalizeStoryFromApi(row))
}

export async function getStoryRecommendations(_userId: string): Promise<Story[]> {
  const allStories: Story[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const res = await apiClient.get<{ data: Record<string, unknown>[]; hasMore?: boolean }>('/api/stories', {
      page,
      limit: 5,
    })
    const items = res.data || []
    const flattened = flattenStoryData(items)
    allStories.push(...flattened)
    hasMore = Boolean(res.hasMore)
    page += 1
    if (flattened.length === 0) break
  }

  return allStories
}

export async function createStory(storyData: CreateStoryData): Promise<Story> {
  const res = await apiClient.post<SingleResponse<Record<string, unknown>>>('/api/stories', storyData)
  return denormalizeStoryFromApi(res.data as Record<string, unknown>)
}

export async function deleteStory(storyId: string): Promise<void> {
  await apiClient.delete(`/api/stories/${storyId}`)
}

export async function getUserStories(_userId: string): Promise<Story[]> {
  const res = await apiClient.get<ListResponse<Record<string, unknown>>>('/api/stories/mine')
  return (res.data || []).map((row) => denormalizeStoryFromApi(row as Record<string, unknown>))
}

export async function recordStoryView(storyId: string, _viewerId: string): Promise<void> {
  await apiClient.post(`/api/stories/${storyId}/view`).catch(() => {})
}

export async function getStoryViewers(storyId: string): Promise<StoryView[]> {
  const allViewers: StoryView[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const res = await apiClient.get<ListResponse<StoryView>>(`/api/stories/${storyId}/viewers`, { page, limit: 20 })
    const items = res.data || []
    allViewers.push(...items)
    hasMore = Boolean(res.hasMore)
    page += 1
    if (items.length === 0) break
  }

  return allViewers
}

export async function addStoryReaction(
  storyId: string,
  _userId: string,
  reactionType: string = 'like'
): Promise<StoryReaction> {
  const res = await apiClient.post<SingleResponse<StoryReaction>>(`/api/stories/${storyId}/reaction`, {
    reaction_type: reactionType,
  })
  return res.data
}

export async function removeStoryReaction(storyId: string, _userId: string): Promise<void> {
  await apiClient.delete(`/api/stories/${storyId}/reaction`)
}

export async function getStoryReactions(storyId: string): Promise<StoryReaction[]> {
  const allReactions: StoryReaction[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const res = await apiClient.get<ListResponse<StoryReaction>>(`/api/stories/${storyId}/reaction`, { page, limit: 20 })
    const items = res.data || []
    allReactions.push(...items)
    hasMore = Boolean(res.hasMore)
    page += 1
    if (items.length === 0) break
  }

  return allReactions
}

export async function getUserStoryReaction(storyId: string, _userId: string): Promise<StoryReaction | null> {
  try {
    const reactions = await getStoryReactions(storyId)
    return reactions.find((r) => r.user_id === _userId) || null
  } catch {
    return null
  }
}

export async function addStoryReply(
  storyId: string,
  _authorId: string,
  content: string
): Promise<StoryReply> {
  const res = await apiClient.post<SingleResponse<StoryReply>>(`/api/stories/${storyId}/replies`, { content })
  return res.data
}

export async function deleteStoryReply(replyId: string, storyId: string): Promise<void> {
  await apiClient.delete(`/api/stories/${storyId}/replies?replyId=${replyId}`)
}

export async function getStoryReplies(storyId: string): Promise<StoryReply[]> {
  const allReplies: StoryReply[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const res = await apiClient.get<ListResponse<StoryReply>>(`/api/stories/${storyId}/replies`, { page, limit: 20 })
    const items = res.data || []
    allReplies.push(...items)
    hasMore = Boolean(res.hasMore)
    page += 1
    if (items.length === 0) break
  }

  return allReplies
}

export async function getStoryAnalytics(_userId: string): Promise<{
  totalStories: number
  totalViews: number
  totalReactions: number
  totalReplies: number
  averageViews: number
  topStories: Story[]
}> {
  const res = await apiClient.get<{
    totalStories: number
    totalViews: number
    totalReactions: number
    totalReplies: number
    averageViews: number
    topStories: Record<string, unknown>[]
  }>('/api/stories/analytics')
  return {
    ...res,
    topStories: (res.topStories || []).map((row) => denormalizeStoryFromApi(row)),
  }
}

export async function cleanupExpiredStories(): Promise<void> {
  // This is an admin operation — keep it server-side only.
  // Call via a cron job or admin endpoint, not from the client.
  console.warn('cleanupExpiredStories should be called from server-side only')
}
