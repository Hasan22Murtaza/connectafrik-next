'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, LogOut, Monitor } from '@/shared/icons'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiError } from '@/lib/api-client'
import {
  buildClientSessionDeviceLabelAsync,
  getSessionIdFromAccessToken,
} from '@/shared/utils/sessionDeviceLabel'
import toast from 'react-hot-toast'
import { useConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { messageE2eeFlagOn } from '@/lib/message-e2ee/status'
import { Divider, SettingsCard, SettingsSectionHeader } from './SettingsPrimitives'

type ListedAuthSession = {
  id: string
  device_label: string
  ip: string | null
  last_active_at: string
}

export function DevicesSettingsPanel() {
  const { user, session, signOut, signOutAllDevices } = useAuth()
  const { confirm, dialog } = useConfirmDialog()

  const [authSessions, setAuthSessions] = useState<ListedAuthSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null)
  const [messageE2eeEnabled, setMessageE2eeEnabled] = useState<boolean | null>(null)

  const currentAuthSessionId = getSessionIdFromAccessToken(session?.access_token ?? null)

  const loadAuthSessions = useCallback(async () => {
    if (!user) return
    setSessionsLoading(true)
    try {
      if (typeof navigator !== 'undefined') {
        const deviceLabel = await buildClientSessionDeviceLabelAsync()
        await apiClient
          .post('/api/auth/sessions/heartbeat', {
            deviceLabel,
            userAgent: navigator.userAgent,
          })
          .catch(() => {})
      }
      const res = await apiClient.get<{ sessions: ListedAuthSession[]; count: number }>('/api/auth/sessions')
      setAuthSessions(res.sessions)
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not load active sessions.'
      toast.error(msg)
      setAuthSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) void loadAuthSessions()
  }, [user, loadAuthSessions])

  useEffect(() => {
    let cancelled = false
    void messageE2eeFlagOn().then((on) => {
      if (!cancelled) setMessageE2eeEnabled(on)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleRevokeAuthSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId)
    try {
      await apiClient.delete(`/api/auth/sessions/${sessionId}`)
      toast.success('That device has been signed out.')
      if (sessionId === currentAuthSessionId) {
        await signOut()
      } else {
        await loadAuthSessions()
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not sign out that device.'
      toast.error(msg)
    } finally {
      setRevokingSessionId(null)
    }
  }

  return (
    <>
      <div className="space-y-4">
        <SettingsCard>
          <SettingsSectionHeader
            title="Logged-in devices"
            description={
              sessionsLoading
                ? 'Loading sessions…'
                : `${authSessions.length} active ${authSessions.length === 1 ? 'session' : 'sessions'}`
            }
          />
          <ul>
            {sessionsLoading && authSessions.length === 0 ? (
              <li className="px-5 py-4 text-sm text-content-secondary">Loading sessions…</li>
            ) : authSessions.length === 0 ? (
              <li className="px-5 py-4 text-sm text-content-secondary">No active sessions found.</li>
            ) : (
              authSessions.map((s, index) => {
                const isCurrent = currentAuthSessionId === s.id
                let lastActiveLabel = ''
                try {
                  lastActiveLabel = formatDistanceToNow(new Date(s.last_active_at), {
                    addSuffix: true,
                  })
                } catch {
                  lastActiveLabel = ''
                }
                return (
                  <li key={s.id}>
                    {index > 0 ? <Divider /> : null}
                    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-surface-secondary text-content-secondary">
                          <Monitor className="h-[18px] w-[18px]" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-medium text-content">{s.device_label}</div>
                          <div className="mt-0.5 text-sm text-content-secondary">
                            {s.ip ? `IP ${s.ip} · ` : ''}
                            {lastActiveLabel ? `Active ${lastActiveLabel}` : null}
                          </div>
                          {isCurrent ? (
                            <span className="mt-1 inline-block text-xs font-medium text-primary">This device</span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={revokingSessionId === s.id}
                        onClick={() => handleRevokeAuthSession(s.id)}
                        className="btn-secondary min-h-11 shrink-0 rounded-[14px] px-4 text-sm disabled:opacity-50"
                      >
                        {revokingSessionId === s.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Signing out…
                          </>
                        ) : (
                          'Log out'
                        )}
                      </button>
                    </div>
                  </li>
                )
              })
            )}
          </ul>
          <Divider />
          <div className="px-4 py-4 sm:px-5">
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const confirmed = await confirm({
                    title: 'Sign out all devices',
                    message: 'Sign out on every device? You will need to sign in again on each one.',
                    confirmLabel: 'Sign out all',
                  })
                  if (!confirmed) return
                  void signOutAllDevices()
                })()
              }}
              className="btn-secondary min-h-11 w-full rounded-[14px] sm:w-auto"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out of all devices</span>
            </button>
          </div>
        </SettingsCard>

        {messageE2eeEnabled === null ? null : (
          <SettingsCard>
            <SettingsSectionHeader
              title="Message encryption"
              description={
                messageE2eeEnabled
                  ? 'End-to-end encryption uses Signal Protocol keys that stay on this browser. Messages encrypted here can be read on this device.'
                  : 'End-to-end encryption is off for this account. Messages stay on the current storage path.'
              }
            />
          </SettingsCard>
        )}
      </div>
      {dialog}
    </>
  )
}
