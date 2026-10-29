'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Portal from '@/shared/components/ui/Portal'
import { Clock } from '@/shared/icons'
import {
  familyService,
  type FamilyMeStatus,
} from '@/features/settings/services/familyService'

const PING_INTERVAL_MS = 60_000
const STATUS_POLL_MS = 30_000

function isScreenTimeBlocked(me: FamilyMeStatus | null): boolean {
  if (!me?.controls_active) return false
  // Rules.enabled is the source of truth for the child overlay. The parental
  // controls master switch is kept in sync on save, but older rows may only
  // have rules.enabled flipped on.
  if (!me.screen_time?.rules?.enabled) return false
  return me.screen_time.evaluation?.allowed === false
}

function blockTitle(reason?: string) {
  switch (reason) {
    case 'daily_limit':
      return 'Daily limit reached'
    case 'bedtime':
      return 'Bedtime is active'
    case 'outside_allowed_hours':
      return 'Outside allowed hours'
    default:
      return 'CribsTalk pause'
  }
}

/**
 * App-wide CribsTalk usage gate for managed child/teen accounts.
 * Tracks session minutes and shows a blocking modal when limits apply.
 */
export default function ScreenTimeGate() {
  const { user, loading: authLoading, signOut } = useAuth()
  const [me, setMe] = useState<FamilyMeStatus | null>(null)
  const [ready, setReady] = useState(false)

  const refreshStatus = useCallback(async () => {
    if (!user) {
      setMe(null)
      setReady(true)
      return
    }
    try {
      const status = await familyService.getMe()
      setMe(status)
    } catch {
      // Non-fatal: existing users / offline should not break the app.
    } finally {
      setReady(true)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    void refreshStatus()
  }, [authLoading, refreshStatus])

  // Periodic status refresh (picks up parent rule changes without waiting for a ping).
  useEffect(() => {
    if (!user || !me?.controls_active) return
    const id = window.setInterval(() => {
      void refreshStatus()
    }, STATUS_POLL_MS)
    return () => window.clearInterval(id)
  }, [user, me?.controls_active, refreshStatus])

  // Usage pings while managed + rules enabled and the child is still allowed.
  useEffect(() => {
    if (!user || !me?.controls_active) return
    if (!me.screen_time?.rules?.enabled) return
    if (me.screen_time.evaluation?.allowed === false) return

    let cancelled = false

    const ping = async () => {
      try {
        const result = await familyService.pingUsage()
        if (cancelled) return
        if (result.evaluation) {
          setMe((prev) => {
            if (!prev?.screen_time) return prev
            return {
              ...prev,
              screen_time: {
                ...prev.screen_time,
                used_minutes_today:
                  result.used_minutes_today ??
                  result.evaluation?.usedMinutes ??
                  prev.screen_time.used_minutes_today,
                evaluation: result.evaluation,
              },
            }
          })
        } else {
          void refreshStatus()
        }
      } catch {
        // ignore
      }
    }

    void ping()
    const id = window.setInterval(() => {
      void ping()
    }, PING_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [
    user,
    me?.controls_active,
    me?.screen_time?.rules?.enabled,
    me?.screen_time?.evaluation?.allowed,
    refreshStatus,
  ])

  if (authLoading || !ready || !user) return null

  const blocked = isScreenTimeBlocked(me)
  if (!blocked || !me?.screen_time) return null

  const evaluation = me.screen_time.evaluation
  const used = evaluation?.usedMinutes ?? me.screen_time.used_minutes_today ?? 0
  const limit = evaluation?.dailyLimitMinutes ?? me.screen_time.rules.daily_limit_minutes
  const message =
    evaluation?.message ||
    'You have reached your CribsTalk screen-time limit. Ask a parent to adjust your limits.'

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/60 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="screen-time-gate-title"
      >
        <div className="w-full max-w-md overflow-hidden rounded-[16px] border border-border bg-surface p-6 shadow-dropdown">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
            <Clock className="h-6 w-6" />
          </div>
          <h2 id="screen-time-gate-title" className="text-lg font-semibold text-content">
            {blockTitle(evaluation?.reason)}
          </h2>
          <p className="mt-2 text-sm text-content-secondary">{message}</p>
          {typeof limit === 'number' && evaluation?.reason === 'daily_limit' ? (
            <p className="mt-3 text-sm text-content-secondary">
              Used today: <span className="font-medium text-content">{used}m</span>
              {' · '}
              Daily limit: <span className="font-medium text-content">{limit}m</span>
            </p>
          ) : null}
          <p className="mt-4 text-xs text-content-tertiary">
            CribsTalk is paused until a parent updates your screen-time settings, or until tomorrow
            if only today’s limit applies.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex min-h-11 items-center justify-center rounded-[14px] border border-border px-4 text-sm font-semibold text-content"
            >
              Sign out
            </button>
            <button
              type="button"
              onClick={() => void refreshStatus()}
              className="inline-flex min-h-11 items-center justify-center rounded-[14px] bg-primary px-4 text-sm font-semibold text-white"
            >
              Check again
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
