'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
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
import type { GschOpportunity } from '@/shared/types/gsch'

export default function OpportunityDetailPanel({ id }: { id: string }) {
  const { user, loading: authLoading } = useAuth()
  const [item, setItem] = useState<GschOpportunity | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<GschOpportunity>(`/api/gsch/opportunities/${id}`)
      setItem(data)
    } catch (err) {
      setItem(null)
      toast.error(err instanceof ApiError ? err.message : 'Failed to load opportunity')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (authLoading || !user) return
    load()
  }, [authLoading, user?.id, load])

  if (authLoading || loading) {
    return <div className={`${GSCH_CARD} h-48 animate-pulse`} />
  }
  if (!user) return <EmptyState title="Sign in required" />
  if (!item) return <EmptyState title="Opportunity not found" />

  const location = [item.location_label, item.country, item.continent]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="space-y-6">
      <GschDetailHeader
        backHref="/global-hub/opportunities"
        backLabel="Back to opportunities"
        title={item.title}
        badges={<StatusBadge status={item.is_published ? 'published' : 'draft'} />}
        subtitle={
          <span className="capitalize">
            {item.category.replace(/_/g, ' ')}
            {item.organization?.name ? ` · ${item.organization.name}` : ''}
          </span>
        }
        meta={location || undefined}
      />

      {item.summary ? (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Summary</h3>
          <p className="mt-2 text-sm leading-relaxed text-content-secondary">
            {item.summary}
          </p>
        </section>
      ) : null}

      {item.description ? (
        <section className={GSCH_CARD}>
          <h3 className={GSCH_SECTION_TITLE}>Details</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-content-secondary">
            {item.description}
          </p>
        </section>
      ) : null}

      <section className={GSCH_CARD}>
        <h3 className={GSCH_SECTION_TITLE}>Key info</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {item.application_deadline ? (
            <div>
              <dt className="text-content-tertiary">Application deadline</dt>
              <dd className="text-content">
                {new Date(item.application_deadline).toLocaleString()}
              </dd>
            </div>
          ) : null}
          {item.starts_at ? (
            <div>
              <dt className="text-content-tertiary">Starts</dt>
              <dd className="text-content">
                {new Date(item.starts_at).toLocaleString()}
              </dd>
            </div>
          ) : null}
          {item.ends_at ? (
            <div>
              <dt className="text-content-tertiary">Ends</dt>
              <dd className="text-content">{new Date(item.ends_at).toLocaleString()}</dd>
            </div>
          ) : null}
          {item.contact_email ? (
            <div>
              <dt className="text-content-tertiary">Contact</dt>
              <dd>
                <a
                  href={`mailto:${item.contact_email}`}
                  className="text-primary hover:underline"
                >
                  {item.contact_email}
                </a>
              </dd>
            </div>
          ) : null}
          {item.external_url ? (
            <div>
              <dt className="text-content-tertiary">External link</dt>
              <dd>
                <a
                  href={item.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Open link
                </a>
              </dd>
            </div>
          ) : null}
          {item.city ? (
            <div>
              <dt className="text-content-tertiary">Related city</dt>
              <dd>
                <Link
                  href={`/global-hub/cities/${item.city.id}`}
                  className="text-primary hover:underline"
                >
                  {item.city.name}
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>
        {item.tags?.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span key={tag} className={GSCH_CHIP}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}
