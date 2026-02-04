import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CULTURE_SUBCATEGORIES, type CultureSubcategorySlug } from '@/shared/constants/culture'

export interface CultureCategoryCount {
  slug: CultureSubcategorySlug
  name: string
  icon: string
  description: string
  count: number
}

export interface FeaturedByCountry {
  country: string
  feature: string
  participants: number
}

export interface CultureStats {
  totalPosts: number
  enthusiastsCount: number
  categoryCounts: CultureCategoryCount[]
  featuredThisWeek: FeaturedByCountry[]
  loading: boolean
  error: string | null
  refetch: () => void
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function useCultureStats(): CultureStats {
  const { user } = useAuth()
  const [totalPosts, setTotalPosts] = useState(0)
  const [enthusiastsCount, setEnthusiastsCount] = useState(0)
  const [categoryCounts, setCategoryCounts] = useState<CultureCategoryCount[]>([])
  const [featuredThisWeek, setFeaturedThisWeek] = useState<FeaturedByCountry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let countRes = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('category', 'culture')
        .eq('is_deleted', false)
      let postsRes = await supabase
        .from('posts')
        .select('author_id, tags, created_at, likes_count, author:profiles!posts_author_id_fkey(country)')
        .eq('category', 'culture')
        .eq('is_deleted', false)

      const errMsg = countRes.error?.message ?? postsRes.error?.message ?? ''
      if ((countRes.error || postsRes.error) && /column|is_deleted|does not exist/i.test(errMsg)) {
        countRes = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('category', 'culture')
        postsRes = await supabase
          .from('posts')
          .select('author_id, tags, created_at, likes_count, author:profiles!posts_author_id_fkey(country)')
          .eq('category', 'culture')
      }

      if (countRes.error) {
        setError(countRes.error.message ?? 'Failed to load culture stats')
        setLoading(false)
        return
      }
      if (postsRes.error) {
        setError(postsRes.error.message ?? 'Failed to load culture posts for stats')
        setLoading(false)
        return
      }

      // Supabase returns foreign key relations as arrays
      const posts = (postsRes.data || []) as Array<{
        author_id: string
        tags: string[] | null
        created_at: string
        likes_count: number
        author: { country: string | null }[] | null
      }>
      const total =
        (countRes as { count?: number }).count ??
        (Array.isArray(postsRes.data) ? postsRes.data.length : 0)
      setTotalPosts(total)

      const authorIds = new Set(posts.map(p => p.author_id))
      setEnthusiastsCount(authorIds.size)

      const counts: CultureCategoryCount[] = CULTURE_SUBCATEGORIES.map(cat => ({
        ...cat,
        count: posts.filter(p => p.tags && Array.isArray(p.tags) && p.tags.includes(cat.slug)).length
      }))
      setCategoryCounts(counts)

      const weekAgo = new Date(Date.now() - WEEK_MS).toISOString()
      const recent = posts.filter(p => p.created_at >= weekAgo)
      const byCountry = new Map<string, { count: number; likes: number }>()
      for (const p of recent) {
        const country = (Array.isArray(p.author) ? p.author[0] : p.author)?.country ?? 'Unknown'
        const cur = byCountry.get(country) ?? { count: 0, likes: 0 }
        byCountry.set(country, { count: cur.count + 1, likes: cur.likes + (p.likes_count || 0) })
      }
      const featured = Array.from(byCountry.entries())
        .filter(([c]) => c !== 'Unknown')
        .map(([country, { count, likes }]) => ({
          country,
          feature: `${count} post${count !== 1 ? 's' : ''} this week`,
          participants: count + likes
        }))
        .sort((a, b) => b.participants - a.participants)
        .slice(0, 5)
      setFeaturedThisWeek(featured)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load culture stats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    if (user?.id) {
      fetchStats()
    }
  }, [user?.id, fetchStats])

  return {
    totalPosts,
    enthusiastsCount,
    categoryCounts,
    featuredThisWeek,
    loading,
    error,
    refetch: fetchStats
  }
}
