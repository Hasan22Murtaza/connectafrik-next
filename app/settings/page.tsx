'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Eye, EyeOff, Save, Trash2, AlertTriangle, Download, Monitor, X,
} from '@/shared/icons'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/shared/hooks/useProfile'
import { apiClient, ApiError } from '@/lib/api-client'
import {
  buildClientSessionDeviceLabelAsync,
  getSessionIdFromAccessToken,
} from '@/shared/utils/sessionDeviceLabel'
import toast from 'react-hot-toast'
import { useConfirmDialog } from '@/shared/components/ui/ConfirmDialog'

type ListedAuthSession = {
  id: string
  device_label: string
  ip: string | null
  last_active_at: string
}

const SecuritySettings: React.FC = () => {
  const { user, session, signOut, signOutAllDevices } = useAuth()
  const { profile, updateProfile } = useProfile()

  const [securitySettings, setSecuritySettings] = useState({
    two_factor_enabled: false,
    login_alerts: true,
    data_download_requested: false,
  })

  const [isSaving, setIsSaving] = useState(false)
  const [authSessions, setAuthSessions] = useState<ListedAuthSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null)
  const { confirm, dialog } = useConfirmDialog()
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirm: '',
  })
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [showPwCurrent, setShowPwCurrent] = useState(false)
  const [showPwNew, setShowPwNew] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)

  const canChangePassword =
    Boolean(user?.email?.trim()) &&
    Boolean(user?.identities?.some((i) => i.provider === 'email'))

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
      const msg =
        e instanceof ApiError ? e.message : 'Could not load active sessions.'
      toast.error(msg)
      setAuthSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      void loadAuthSessions()
    }
  }, [user, loadAuthSessions])

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

  useEffect(() => {
    if (!showChangePasswordModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPwCurrent(false)
        setShowPwNew(false)
        setShowPwConfirm(false)
        setShowChangePasswordModal(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showChangePasswordModal])

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordForm.next !== passwordForm.confirm) {
      toast.error('New passwords do not match.')
      return
    }
    if (passwordForm.next.length < 8) {
      toast.error('New password must be at least 8 characters.')
      return
    }
    setPasswordBusy(true)
    try {
      await apiClient.post<{ updated: boolean }>('/api/auth/change-password', {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next,
      })
      toast.success('Password updated successfully.')
      setPasswordForm({ current: '', next: '', confirm: '' })
      setShowPwCurrent(false)
      setShowPwNew(false)
      setShowPwConfirm(false)
      setShowChangePasswordModal(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not change password.')
    } finally {
      setPasswordBusy(false)
    }
  }

  useEffect(() => {
    if (profile) {
      setSecuritySettings({
        two_factor_enabled: profile.two_factor_enabled ?? false,
        login_alerts: profile.login_alerts ?? true,
        data_download_requested: profile.data_download_requested ?? false,
      })
    }
  }, [profile])

  const handleSecurityUpdate = async () => {
    setIsSaving(true)
    try {
      const { error } = await updateProfile({
        two_factor_enabled: securitySettings.two_factor_enabled,
        login_alerts: securitySettings.login_alerts,
      })
      if (error) {
        toast.error(error)
      } else {
        toast.success('Security settings updated successfully!')
      }
    } catch (error) {
      toast.error('Failed to update security settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    const confirmed = await confirm({
      title: 'Delete account',
      message: 'Are you sure you want to delete your account? This action cannot be undone.',
      confirmLabel: 'Delete',
    })
    if (!confirmed) {
      return
    }

    const confirmation = prompt('Type "DELETE" to confirm account deletion:')
    if (confirmation !== 'DELETE') {
      toast.error('Account deletion cancelled')
      return
    }

    try {
      toast.error('Account deletion not implemented yet. Please contact support.')
    } catch (error) {
      toast.error('Failed to delete account')
    }
  }

  const handleDataDownload = async () => {
    try {
      const res = await apiClient.get<{ data: any }>('/api/users/me/export')
      const userData = res?.data ?? {}

      const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cribstalk-data-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)

      toast.success('Data exported successfully!')
    } catch (error) {
      toast.error('Failed to export data')
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-content mb-4">Please Sign In</h1>
          <p className="text-content-secondary">You need to be signed in to view your security settings.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen ">
        <div className="max-w-full 2xl:max-w-screen-2xl mx-auto px-4 py-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-content">Settings</h1>
            <p className="text-content-secondary">Manage your account security settings</p>
          </div>
          <div className="space-y-6">
          <div className="bg-surface rounded-2xl shadow-card p-4">
            <div className="sm:p-6 p-4 border-b border-border">
              <h2 className="text-xl font-semibold text-content">Account Security</h2>
              <p className="text-content-secondary">Manage your account security settings</p>
            </div>

            <div className="sm:p-6 py-6 space-y-6">
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="max-w-[320px]">
                    <div className="font-medium text-content">Two-Factor Authentication</div>
                    <div className="text-sm text-content-secondary">Add an extra layer of security to your account</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={securitySettings.two_factor_enabled}
                    onChange={(e) => setSecuritySettings({
                      ...securitySettings,
                      two_factor_enabled: e.target.checked,
                    })}
                    className="text-primary-600"
                  />
                </label>

                <label className=" flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="sm:max-w-full max-w-[240px]">
                    <div className="font-medium text-content">Login Alerts</div>
                    <div className="text-sm text-content-secondary">Get notified when someone logs into your account</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={securitySettings.login_alerts}
                    onChange={(e) => setSecuritySettings({
                      ...securitySettings,
                      login_alerts: e.target.checked,
                    })}
                    className="text-primary-600"
                  />
                </label>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-border flex items-start gap-3">
                  <Monitor className="w-5 h-5 text-content-secondary shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <h3 className="font-medium text-content">Where you&apos;re logged in</h3>
                    <p className="text-sm text-content-secondary">
                      {sessionsLoading
                        ? 'Loading sessions…'
                        : `${authSessions.length} active ${authSessions.length === 1 ? 'session' : 'sessions'}`}
                    </p>
                  </div>
                </div>
                <ul className="divide-y divide-gray-100">
                  {sessionsLoading && authSessions.length === 0 ? (
                    <li className="p-4 text-sm text-content-secondary">Loading sessions…</li>
                  ) : authSessions.length === 0 ? (
                    <li className="p-4 text-sm text-content-secondary">No active sessions found.</li>
                  ) : (
                    authSessions.map((s) => {
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
                        <li
                          key={s.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-content truncate">{s.device_label}</div>
                            <div className="text-sm text-content-secondary mt-0.5">
                              {s.ip ? `IP ${s.ip} · ` : ''}
                              {lastActiveLabel ? `Active ${lastActiveLabel}` : null}
                            </div>
                            {isCurrent ? (
                              <span className="inline-block mt-1 text-xs font-medium text-orange-600">
                                This device
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            disabled={revokingSessionId === s.id}
                            onClick={() => handleRevokeAuthSession(s.id)}
                            className="btn-secondary text-sm px-4 py-2 shrink-0 disabled:opacity-50"
                          >
                            {revokingSessionId === s.id ? 'Signing out…' : 'Log out'}
                          </button>
                        </li>
                      )
                    })
                  )}
                </ul>
              </div>

              <div className="flex justify-between items-center flex-wrap gap-4">
                <div className="flex  gap-4">
                  <button
                    type="button"
                    disabled={!canChangePassword}
                    title={
                      canChangePassword
                        ? undefined
                        : 'Only available when you signed up with email and password.'
                    }
                    onClick={() => {
                      if (!canChangePassword) {
                        toast.error(
                          'Password change is only for accounts that use email sign-in.'
                        )
                        return
                      }
                      setShowChangePasswordModal(true)
                    }}
                    className="btn-secondary w-full sm:w-auto disabled:opacity-50"
                  >
                    Change Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        const confirmed = await confirm({
                          title: 'Sign out all devices',
                          message:
                            'Sign out on every device? You will need to sign in again on each one.',
                          confirmLabel: 'Sign out all',
                        })
                        if (!confirmed) return
                        void signOutAllDevices()
                      })()
                    }}
                    className="btn-secondary w-full sm:w-auto"
                  >
                    Sign Out All Devices
                  </button>
                </div>
                <button
                  onClick={handleSecurityUpdate}
                  disabled={isSaving}
                  className="btn-primary flex-1  flex items-center justify-center space-x-2 disabled:opacity-50 w-auto px-8 py-2.5  sm:max-w-[280px] max-w-full "
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-2xl shadow-card p-4">
            <div className="sm:p-6 p-4 border-b border-border">
              <h2 className="text-xl font-semibold text-content">Data & Privacy</h2>
              <p className="text-content-secondary">Download your data or delete your account</p>
            </div>

            <div className="sm:p-6 pt-6 space-y-4">
              <div className="sm:flex-row flex gap-4  flex-col">
                <button
                  onClick={handleDataDownload}
                  className="w-full flex items-center justify-center space-x-2 p-4 border border-gray-300 rounded-lg hover:bg-surface-hover transition-colors duration-200"
                >
                  <Download className="w-5 h-5" />
                  <span>Download My Data</span>
                </button>

                <button
                  onClick={handleDeleteAccount}
                  className="w-full flex items-center justify-center space-x-2 p-4 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 transition-colors duration-200"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Delete Account</span>
                </button>
              </div>

              <div className="text-sm text-content-secondary p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div>
                    <strong>Warning:</strong> Deleting your account will permanently remove all your posts, comments, and personal data. This action cannot be undone.
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      {showChangePasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowPwCurrent(false)
              setShowPwNew(false)
              setShowPwConfirm(false)
              setShowChangePasswordModal(false)
            }
          }}
        >
          <div
            className="bg-surface rounded-xl shadow-xl max-w-md w-full border border-border"
            role="dialog"
            aria-labelledby="change-password-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 id="change-password-title" className="text-lg font-semibold text-content">
                Change password
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowPwCurrent(false)
                  setShowPwNew(false)
                  setShowPwConfirm(false)
                  setShowChangePasswordModal(false)
                }}
                className="p-2 rounded-lg hover:bg-gray-100 text-content-secondary"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleChangePasswordSubmit} className="p-4 space-y-4">
              <p className="text-sm text-content-secondary">
                Enter your current password, then choose a new one (at least 8 characters).
              </p>
              <div>
                <label htmlFor="cp-current" className="block text-sm font-medium text-content mb-1">
                  Current password
                </label>
                <div className="relative">
                  <input
                    id="cp-current"
                    type={showPwCurrent ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwCurrent((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-content-secondary hover:text-gray-800 hover:bg-gray-100"
                    aria-label={showPwCurrent ? 'Hide password' : 'Show password'}
                  >
                    {showPwCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="cp-new" className="block text-sm font-medium text-content mb-1">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="cp-new"
                    type={showPwNew ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={passwordForm.next}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, next: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwNew((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-content-secondary hover:text-gray-800 hover:bg-gray-100"
                    aria-label={showPwNew ? 'Hide new password' : 'Show new password'}
                  >
                    {showPwNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="cp-confirm" className="block text-sm font-medium text-content mb-1">
                  Confirm new password
                </label>
                <div className="relative">
                  <input
                    id="cp-confirm"
                    type={showPwConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwConfirm((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-content-secondary hover:text-gray-800 hover:bg-gray-100"
                    aria-label={showPwConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showPwConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowPwCurrent(false)
                    setShowPwNew(false)
                    setShowPwConfirm(false)
                    setShowChangePasswordModal(false)
                  }}
                  className="btn-secondary px-4 py-2"
                  disabled={passwordBusy}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary px-4 py-2" disabled={passwordBusy}>
                  {passwordBusy ? 'Saving…' : 'Update password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {dialog}
    </>
  )
}

export default SecuritySettings
