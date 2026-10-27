import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getRelationships } from '@/lib/privacy'
import { getVisibleProfileFields } from '@/shared/utils/visibilityUtils'
import { getProfileLocationDisplayLine } from '@/shared/types/location'
import { withBannerImages } from '../_shared/withBannerImages'

type ProfileLocationRow = {
  id: string
  address: string | null
  city: string | null
  state: string | null
  zipcode: string | null
  country: string | null
}

/** Attach a display `location` (and `country` when that field is public). */
async function withLocations<T extends { id?: string; user_id?: string }>(
  supabase: Parameters<typeof withBannerImages>[0],
  viewerId: string,
  rows: T[]
): Promise<Array<T & { location: string | null; country: string | null }>> {
  const ids = [
    ...new Set(
      rows
        .map((row) => row.id || row.user_id)
        .filter((id): id is string => typeof id === 'string')
    ),
  ]

  const locationById = new Map<string, ProfileLocationRow>()
  if (ids.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, address, city, state, zipcode, country')
      .in('id', ids)
    for (const row of data || []) {
      locationById.set(row.id as string, row as ProfileLocationRow)
    }
  }

  const relationships = await getRelationships(viewerId, ids, supabase)

  return rows.map((row) => {
    const id = row.id || row.user_id
    const profile = id ? locationById.get(id) : undefined
    const rel = id ? relationships.get(id) : undefined
    const fields = rel
      ? getVisibleProfileFields(rel.settings, rel.isSelf, rel.isFriend, rel.isBlocked)
      : { location: false, country: false }

    const country = fields.country ? profile?.country?.trim() || null : null
    let location: string | null = null
    if (profile && fields.location) {
      location = getProfileLocationDisplayLine(profile) || null
    } else if (country) {
      location = country
    }

    return { ...row, location, country }
  })
}

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0', 10)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 100)
    const fetchLimit = (page + 1) * limit + 1
    const from = page * limit
    const toExclusive = from + limit

    let suggestions: any[] = []

    const { data: friendRecs, error: friendErr } = await supabase.rpc('get_friend_recommendations', {
      p_user_id: user.id,
      p_limit: fetchLimit,
    })

    if (!friendErr && friendRecs && friendRecs.length > 0) {
      suggestions = friendRecs
    } else {
      const { data: generalRecs, error: generalErr } = await supabase.rpc(
        'get_general_user_recommendations',
        {
          p_user_id: user.id,
          p_limit: fetchLimit,
        }
      )
      if (!generalErr && generalRecs && generalRecs.length > 0) {
        suggestions = generalRecs
      }
    }

    const { filterSearchableUserIds } = await import('@/lib/privacy/access')
    const ids = suggestions
      .map((s: { id?: string; user_id?: string }) => s.id || s.user_id)
      .filter((id: unknown): id is string => typeof id === 'string')
    const visible = await filterSearchableUserIds(user.id, ids, supabase)
    suggestions = suggestions.filter((s: { id?: string; user_id?: string }) => {
      const id = s.id || s.user_id
      return typeof id === 'string' && visible.has(id)
    })

    const paged = suggestions.slice(from, toExclusive)
    const hasMore = suggestions.length > toExclusive
    const withBanners = await withLocations(
      supabase,
      user.id,
      await withBannerImages(supabase, paged)
    )

    const mutualPreviewByUserId = new Map<
      string,
      Array<{ user_id: string; username: string; full_name: string; avatar_url: string | null }>
    >()

    await Promise.all(
      withBanners.map(async (suggestion) => {
        const otherUserId = suggestion.id || suggestion.user_id
        const mutualCount = Number(
          (suggestion as { mutual_friends_count?: number }).mutual_friends_count ?? 0
        )
        if (typeof otherUserId !== 'string' || mutualCount <= 0) {
          if (typeof otherUserId === 'string') mutualPreviewByUserId.set(otherUserId, [])
          return
        }

        const { data: mutuals } = await supabase.rpc('get_mutual_friends', {
          user1_id: user.id,
          user2_id: otherUserId,
          limit_count: 3,
        })

        mutualPreviewByUserId.set(
          otherUserId,
          (mutuals || []).slice(0, 3).map((m: any) => ({
            user_id: m.user_id,
            username: m.username,
            full_name: m.full_name,
            avatar_url: m.avatar_url ?? null,
          }))
        )
      })
    )

    const data = withBanners.map((suggestion) => {
      const otherUserId = suggestion.id || suggestion.user_id
      return {
        ...suggestion,
        mutual_friends:
          typeof otherUserId === 'string'
            ? mutualPreviewByUserId.get(otherUserId) ?? []
            : [],
      }
    })

    return jsonResponse({ data, page, pageSize: limit, hasMore })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    return errorResponse(error.message || 'Failed to get friend suggestions', 500)
  }
}
