'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import YouthShell from '@/features/youth-leadership/components/YouthShell'
import ProgramCard from '@/features/youth-leadership/components/ProgramCard'
import EmptyState from '@/features/youth-leadership/components/EmptyState'
import { YOUTH_CARD } from '@/features/youth-leadership/constants/nav'
import type { YouthProgram } from '@/shared/types/youthLeadership'

type ProgramsPayload = {
  data: YouthProgram[]
  page: number
  pageSize: number
  hasMore: boolean
}

export default function MyYouthProgramsPage() {
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
  }, [authLoading, user, load])

  return (
    <YouthShell
      title="My Programs"
      subtitle="Programs you are enrolled in (active or completed)."
    >
      {authLoading || loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${YOUTH_CARD} h-40 animate-pulse bg-surface-secondary`} />
          ))}
        </div>
      ) : !user ? (
        <EmptyState title="Sign in required" />
      ) : programs.length === 0 ? (
        <EmptyState
          title="No enrollments yet"
          description="Once an application is accepted, the program will appear here."
          action={
            <Link href="/youth-leadership" className="btn-primary">
              Discover programs
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <ProgramCard key={program.id} program={program} />
          ))}
        </div>
      )}
    </YouthShell>
  )
}
