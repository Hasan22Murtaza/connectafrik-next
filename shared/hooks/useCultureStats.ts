import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
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
      const res = await apiClient.get<{
        data: {
          totalPosts: number
          enthusiastsCount: number
          countriesRepresented: number
          tagCounts: Record<string, number>
          featuredThisWeek: Array<{ country: string; count: number; likes: number; participants: number }>
        }
      }>('/api/posts/stats', { category: 'culture' })

      const stats = res.data
      setTotalPosts(stats.totalPosts)
      setEnthusiastsCount(stats.enthusiastsCount)

      const counts: CultureCategoryCount[] = CULTURE_SUBCATEGORIES.map(cat => ({
        ...cat,
        count: stats.tagCounts[cat.slug] || 0,
      }))
      setCategoryCounts(counts)

      setFeaturedThisWeek(
        stats.featuredThisWeek.map(f => ({
          country: f.country,
          feature: `${f.count} post${f.count !== 1 ? 's' : ''} this week`,
          participants: f.participants,
        }))
      )
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
