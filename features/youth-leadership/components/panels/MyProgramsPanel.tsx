'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import ProgramCard from '@/features/youth-leadership/components/ProgramCard'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import YouthSkeleton from '@/features/youth-leadership/components/YouthSkeleton'
import YouthSectionHeader from '@/features/youth-leadership/components/YouthSectionHeader'
import type { YouthProgram } from '@/shared/types/youthLeadership'

type ProgramsPayload = {
  data: YouthProgram[]
  page: number
  pageSize: number
  hasMore: boolean
}

export default function MyProgramsPanel() {
  const { user, loading: authLoading } = useAuth()
  const [programs, setPrograms] = useState<YouthProgram[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await apiClient.get<ProgramsPayload>(
        '/api/youth-leadership/programs',
        { mine: 1, limit: 50 }
      )
      setPrograms(payload?.data || [])
    } catch (err) {
      setPrograms([])
      toast.error(err instanceof ApiError ? err.message : 'Failed to load programs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user?.id, load])

  if (authLoading || loading) return <YouthSkeleton count={3} />
  if (!user) return <EmptyState title="Sign in required" />

  if (programs.length === 0) {
    return (
      <EmptyState
        title="No enrollments yet"
        description="Once an application is accepted, the program will appear here."
        action={
          <Link href="/youth-leadership" className="btn-primary">
            Discover programs
          </Link>
        }
      />
    )
  }

  return (
    <>
      <YouthSectionHeader
        title="Enrolled programs"
        badge={
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {programs.length} active
          </span>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {programs.map((program) => (
          <ProgramCard key={program.id} program={program} />
        ))}
      </div>
    </>
  )
}
