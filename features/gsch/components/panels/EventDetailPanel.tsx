'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/features/gsch/components/EmptyState'
import GschDetailHeader from '@/features/gsch/components/GschDetailHeader'
import StatusBadge from '@/features/gsch/components/StatusBadge'
import {
  GSCH_CARD,
  GSCH_CHIP,
  GSCH_SECTION_TITLE,
} from '@/features/gsch/constants/styles'
import type { GschEvent } from '@/shared/types/gsch'

export default function EventDetailPanel({ id }: { id: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [event, setEvent] = useState<GschEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const registerFromQueryRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<GschEvent>(`/api/gsch/events/${id}`)
      setEvent(data)
    } catch (err) {
      setEvent(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to load event')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user?.id, load])

  useEffect(() => {
    if (loading || !event || searchParams.get('register') !== '1') return
    const shouldRegister =
      event.is_published && !event.is_registered && !registerFromQueryRef.current
    router.replace(`/global-hub/events/${id}`, { scroll: false })
    if (!shouldRegister) return
    registerFromQueryRef.current = true
    void (async () => {
      try {
        const res = await apiClient.post<{ registered: boolean }>(
          `/api/gsch/events/${id}/register`,
          { toggle: true }
        )
        toast.success(res.registered ? 'Registered' : 'Registration cancelled')
        await load()
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : 'Registration failed'
        )
      }
    })()
  }, [loading, event, searchParams, router, id, load])

  if (authLoading || loading) {
    return <div className={`${GSCH_CARD} h-48 animate-pulse`} />
  }
  if (!user) return <EmptyState title="Sign in required" />
  if (!event) {
    return (
      <EmptyState
        title="Event not found"
        action={
          <Link href="/global-hub/events" className="btn-primary text-sm">
            Back to events
          </Link>
        }
      />
    )
  }

  const location = [event.location_label, event.country, event.continent]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="space-y-6">
      <GschDetailHeader
        backHref="/global-hub/events"
        backLabel="Back to events"
        title={event.title}
        badges={<StatusBadge status={event.is_published ? 'published' : 'draft'} />}
        subtitle={
          <span className="capitalize">
            {event.event_type.replace(/_/g, ' ')}
            {event.organization?.name ? ` · ${event.organization.name}` : ''}
          </span>
        }
        meta={location || undefined}
      />

      {event.summary ? (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Summary</h3>
          <p className="mt-2 text-sm leading-relaxed text-content-secondary">
            {event.summary}
          </p>
        </section>
      ) : null}

      {event.description ? (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Details</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-content-secondary">
            {event.description}
          </p>
        </section>
      ) : null}

      <section className={GSCH_CARD}>
        <h3 className={GSCH_SECTION_TITLE}>Key info</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {event.starts_at ? (
            <div>
              <dt className="text-content-tertiary">Starts</dt>
              <dd className="text-content">
                {new Date(event.starts_at).toLocaleString()}
              </dd>
            </div>
          ) : null}
          {event.ends_at ? (
            <div>
              <dt className="text-content-tertiary">Ends</dt>
              <dd className="text-content">
                {new Date(event.ends_at).toLocaleString()}
              </dd>
            </div>
          ) : null}
          {event.contact_email ? (
            <div>
              <dt className="text-content-tertiary">Contact</dt>
              <dd>
                <a
                  href={`mailto:${event.contact_email}`}
                  className="text-primary hover:underline"
                >
                  {event.contact_email}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
        {event.tags?.length ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {event.tags.map((t) => (
              <span key={t} className={GSCH_CHIP}>
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}
