import { createServiceClient } from '@/lib/supabase-server'
import { jsonResponse } from '@/lib/api-utils'

export const REEL_SELECT = `
  *,
  profiles:profiles!reels_author_id_fkey(username, full_name, avatar_url)
`

export const REEL_SELECT_LOCATION = `
  *,
  profiles:profiles!reels_author_id_fkey!inner(username, full_name, avatar_url, country)
`

export type ReelsSupabase = ReturnType<typeof createServiceClient>

export function parseReelListParams(searchParams: URLSearchParams) {
  const category = searchParams.get('category') || undefined
  const is_featured = searchParams.get('is_featured')
  const min_duration = searchParams.get('min_duration')
  const max_duration = searchParams.get('max_duration')
  const tagsParam = searchParams.get('tags')
  const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : undefined
  const search = searchParams.get('search') || undefined
  const country = searchParams.get('country')?.trim() || undefined
  const sort_field = searchParams.get('sort_field') || 'created_at'
  const sort_order = searchParams.get('sort_order') || 'desc'
  const parsedLimit = parseInt(searchParams.get('limit') || '10', 10)
  const parsedPage = parseInt(searchParams.get('page') || '0', 10)
  const limit = Number.isNaN(parsedLimit) ? 10 : Math.min(Math.max(parsedLimit, 1), 100)
  const page = Number.isNaN(parsedPage) ? 0 : Math.max(parsedPage, 0)
  return {
    category,
    is_featured,
    min_duration,
    max_duration,
    tags,
    search,
    country,
    sort_field,
    sort_order,
    limit,
    page,
    from: page * limit,
    to: page * limit + limit - 1,
  }
}

export type ReelListParams = ReturnType<typeof parseReelListParams>

export function emptyReelPage(page: number, limit: number) {
  return jsonResponse({ data: [], page, pageSize: limit, hasMore: false })
}

export async function authorIdsMatchingCountry(
  supabase: ReelsSupabase,
  authorIds: string[],
  country: string
): Promise<{ ids: string[]; error: string | null }> {
  if (authorIds.length === 0) return { ids: [], error: null }
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .in('id', authorIds)
    .ilike('country', `%${country}%`)
  if (error) return { ids: [], error: error.message }
  return { ids: (data ?? []).map((r: { id: string }) => r.id), error: null }
}

/** Apply shared filters to a reels query builder. */
export function applyReelFilters(query: any, params: ReelListParams) {
  let q = query
  if (params.category) q = q.eq('category', params.category)
  if (params.is_featured !== undefined && params.is_featured !== '') {
    q = q.eq('is_featured', params.is_featured === 'true')
  }
  if (params.min_duration != null && params.min_duration !== '') {
    q = q.gte('duration', parseInt(params.min_duration, 10))
  }
  if (params.max_duration != null && params.max_duration !== '') {
    q = q.lte('duration', parseInt(params.max_duration, 10))
  }
  if (params.tags && params.tags.length > 0) q = q.overlaps('tags', params.tags)
  if (params.search) {
    q = q.or(`title.ilike.%${params.search}%,description.ilike.%${params.search}%`)
  }
  if (params.country) q = q.ilike('profiles.country', `%${params.country}%`)
  return q
}

export async function attachViewerFlags(
  supabase: ReelsSupabase,
  reels: Record<string, unknown>[],
  userId: string | null
) {
  let followingSet = new Set<string>()
  let savedSet = new Set<string>()
  let likedSet = new Set<string>()
  let repostedSet = new Set<string>()
  let sharedSet = new Set<string>()
  let viewedSet = new Set<string>()

  if (userId && reels.length > 0) {
    const authorIds = [
      ...new Set(
        reels
          .map((r) => r.author_id as string)
          .filter((id: string) => id && id !== userId)
      ),
    ]
    const reelIds = [...new Set(reels.map((r) => r.id as string).filter(Boolean))]

    if (authorIds.length > 0) {
      const { data: followsData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)
        .in('following_id', authorIds)
      if (followsData) {
        followingSet = new Set(followsData.map((f: { following_id: string }) => f.following_id))
      }
    }

    if (reelIds.length > 0) {
      const [savesData, likesData, repostsData, sharesData, viewsData] = await Promise.all([
        supabase.from('reel_saves').select('reel_id').eq('user_id', userId).in('reel_id', reelIds),
        supabase.from('reel_likes').select('reel_id').eq('user_id', userId).in('reel_id', reelIds),
        supabase.from('reel_reposts').select('reel_id').eq('user_id', userId).in('reel_id', reelIds),
        supabase.from('reel_shares').select('reel_id').eq('user_id', userId).in('reel_id', reelIds),
        supabase.from('reel_views').select('reel_id').eq('user_id', userId).in('reel_id', reelIds),
      ])
      if (savesData.data) savedSet = new Set(savesData.data.map((s: { reel_id: string }) => s.reel_id))
      if (likesData.data) likedSet = new Set(likesData.data.map((s: { reel_id: string }) => s.reel_id))
      if (repostsData.data) {
        repostedSet = new Set(repostsData.data.map((s: { reel_id: string }) => s.reel_id))
      }
      if (sharesData.data) sharedSet = new Set(sharesData.data.map((s: { reel_id: string }) => s.reel_id))
      if (viewsData.data) viewedSet = new Set(viewsData.data.map((s: { reel_id: string }) => s.reel_id))
    }
  }

  return reels.map((reel) => ({
    ...reel,
    is_following:
      userId && userId !== reel.author_id ? followingSet.has(reel.author_id as string) : false,
    is_saved: userId ? savedSet.has(reel.id as string) : false,
    is_liked: userId ? likedSet.has(reel.id as string) : false,
    is_reposted: userId ? repostedSet.has(reel.id as string) : false,
    is_shared: userId ? sharedSet.has(reel.id as string) : false,
    is_viewed: userId ? viewedSet.has(reel.id as string) : false,
  }))
}
