import { apiClient } from '@/lib/api-client'

export interface Story {
  id: string
  user_id: string
  user_name: string
  user_avatar: string
  username?: string
  profile_picture_url?: string
  media_url: string
  media_type: 'image' | 'video'
  text_overlay?: string | null
  background_color: string
  caption?: string | null
  music_url?: string | null
  music_title?: string | null
  music_artist?: string | null
  is_highlight: boolean
  view_count: number
  expires_at: string
  created_at: string
  has_viewed: boolean
  reaction_count?: number
  reply_count?: number
  user_reaction?: string | null
}

export interface CreateStoryData {
  media_url: string
  media_type: 'image' | 'video'
  caption?: string
  music_url?: string
  music_title?: string
  music_artist?: string
  text_overlay?: string
  background_color?: string
  is_highlight?: boolean
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

export async function getStoryRecommendations(_userId: string): Promise<Story[]> {
  const allStories: Story[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const res = await apiClient.get<ListResponse<Story>>('/api/stories', { page, limit: 20 })
    const items = res.data || []
    allStories.push(...items)
    hasMore = Boolean(res.hasMore)
    page += 1
    if (items.length === 0) break
  }

  return allStories
}

export async function createStory(storyData: CreateStoryData): Promise<Story> {
  const res = await apiClient.post<SingleResponse<Story>>('/api/stories', storyData)
  return res.data
}

export async function deleteStory(storyId: string): Promise<void> {
  await apiClient.delete(`/api/stories/${storyId}`)
}

export async function getStoriesByUser(userId: string, _viewerId: string): Promise<Story[]> {
  const allStories: Story[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const res = await apiClient.get<ListResponse<Story>>(`/api/stories/user/${userId}`, { page, limit: 20 })
    const items = res.data || []
    allStories.push(...items)
    hasMore = Boolean(res.hasMore)
    page += 1
    if (items.length === 0) break
  }

  return allStories
}

export async function getUserStories(_userId: string): Promise<Story[]> {
  const allStories: Story[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const res = await apiClient.get<ListResponse<Story>>('/api/stories/mine', { page, limit: 20 })
    const items = res.data || []
    allStories.push(...items)
    hasMore = Boolean(res.hasMore)
    page += 1
    if (items.length === 0) break
  }

  return allStories
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
  const res = await apiClient.get<{ data: any }>('/api/stories/analytics')
  return res.data
}

export async function cleanupExpiredStories(): Promise<void> {
  // This is an admin operation — keep it server-side only.
  // Call via a cron job or admin endpoint, not from the client.
  console.warn('cleanupExpiredStories should be called from server-side only')
}
