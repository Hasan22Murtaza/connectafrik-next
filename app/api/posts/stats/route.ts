import { NextRequest } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { CULTURE_SUBCATEGORIES } from '@/shared/constants/culture'
import { POLITICS_SUBCATEGORIES } from '@/shared/constants/politics'

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await getAuthenticatedUser(request)

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    if (!category || !['culture', 'politics'].includes(category)) {
      return errorResponse('category query param must be "culture" or "politics"', 400)
    }

    let countRes = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('category', category)
      .eq('is_deleted', false)

    let postsRes = await supabase
      .from('posts')
      .select('author_id, tags, created_at, likes_count')
      .eq('category', category)
      .eq('is_deleted', false)

    const errMsg = countRes.error?.message ?? postsRes.error?.message ?? ''
    if ((countRes.error || postsRes.error) && /column|is_deleted|does not exist/i.test(errMsg)) {
      countRes = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('category', category)
      postsRes = await supabase
        .from('posts')
        .select('author_id, tags, created_at, likes_count')
        .eq('category', category)
    }

    if (countRes.error) throw new Error(countRes.error.message)
    if (postsRes.error) throw new Error(postsRes.error.message)

    const posts = (postsRes.data || []) as Array<{
      author_id: string
      tags: string[] | null
      created_at: string
      likes_count: number
    }>

    const totalPosts = (countRes as any).count ?? posts.length

    const authorIds = [...new Set(posts.map(p => p.author_id))]
    const enthusiastsCount = authorIds.length

    let authorCountryMap = new Map<string, string>()
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, country')
        .in('id', authorIds)

      for (const p of profiles || []) {
        if (p.country) authorCountryMap.set(p.id, p.country)
      }
    }

    const countries = new Set(
      [...authorCountryMap.values()].filter(c => c && c !== 'Unknown')
    )
    const countriesRepresented = countries.size

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const recent = posts.filter(p => p.created_at >= weekAgo)
    const byCountry = new Map<string, { count: number; likes: number }>()
    for (const p of recent) {
      const country = authorCountryMap.get(p.author_id) ?? 'Unknown'
      const cur = byCountry.get(country) ?? { count: 0, likes: 0 }
      byCountry.set(country, { count: cur.count + 1, likes: cur.likes + (p.likes_count || 0) })
    }

    const featuredThisWeek = Array.from(byCountry.entries())
      .filter(([c]) => c !== 'Unknown')
      .map(([country, { count, likes }]) => ({
        country,
        count,
        likes,
        participants: count + likes,
      }))
      .sort((a, b) => b.participants - a.participants)
      .slice(0, 5)

    const baseTagCounts = (
      category === 'culture' ? CULTURE_SUBCATEGORIES : POLITICS_SUBCATEGORIES
    ).reduce<Record<string, number>>((acc, item) => {
      acc[item.slug] = 0
      return acc
    }, {})

    const tagCounts: Record<string, number> = { ...baseTagCounts }
    for (const p of posts) {
      if (p.tags && Array.isArray(p.tags)) {
        for (const tag of p.tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1
        }
      }
    }

    return jsonResponse({
      data: {
        totalPosts,
        enthusiastsCount,
        countriesRepresented,
        tagCounts,
        featuredThisWeek,
      },
    })
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return unauthorizedResponse()
    }
    console.error('GET /api/posts/stats error:', err)
    return errorResponse(err.message || 'Failed to fetch stats', 500)
  }
}
