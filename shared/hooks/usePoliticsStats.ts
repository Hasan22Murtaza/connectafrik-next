import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { POLITICS_SUBCATEGORIES, type PoliticsSubcategorySlug } from '@/shared/constants/politics'

export interface PoliticsTopicCount {
  slug: PoliticsSubcategorySlug
  name: string
  icon: string
  description: string
  count: number
}

export interface PoliticsFeaturedByCountry {
  country: string
  feature: string
  participants: number
}

export interface PoliticsStats {
  totalPosts: number
  enthusiastsCount: number
  countriesRepresented: number
  topicCounts: PoliticsTopicCount[]
  featuredThisWeek: PoliticsFeaturedByCountry[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function usePoliticsStats(): PoliticsStats {
  const { user } = useAuth()
  const [totalPosts, setTotalPosts] = useState(0)
  const [enthusiastsCount, setEnthusiastsCount] = useState(0)
  const [countriesRepresented, setCountriesRepresented] = useState(0)
  const [topicCounts, setTopicCounts] = useState<PoliticsTopicCount[]>([])
  const [featuredThisWeek, setFeaturedThisWeek] = useState<PoliticsFeaturedByCountry[]>([])
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
      }>('/api/posts/stats', { category: 'politics' })

      const stats = res.data
      setTotalPosts(stats.totalPosts)
      setEnthusiastsCount(stats.enthusiastsCount)
      setCountriesRepresented(stats.countriesRepresented)

      const counts: PoliticsTopicCount[] = POLITICS_SUBCATEGORIES.map(cat => ({
        ...cat,
        count: stats.tagCounts[cat.slug] || 0,
      }))
      setTopicCounts(counts)

      setFeaturedThisWeek(
        stats.featuredThisWeek.map(f => ({
          country: f.country,
          feature: `${f.count} discussion${f.count !== 1 ? 's' : ''} this week`,
          participants: f.participants,
        }))
      )
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load politics stats')
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
    countriesRepresented,
    topicCounts,
    featuredThisWeek,
    loading,
    error,
    refetch: fetchStats
  }
}
