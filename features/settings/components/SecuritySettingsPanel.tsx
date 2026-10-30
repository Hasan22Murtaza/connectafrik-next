'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Download,
  Lock,
  Mail,
  Shield,
  Trash2,
} from '@/shared/icons'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/shared/hooks/useProfile'
import { apiClient, ApiError } from '@/lib/api-client'
import toast from 'react-hot-toast'
import { useConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { ChangePasswordModal } from './ChangePasswordModal'
import { TwoFactorSetupModal } from './TwoFactorSetupModal'
import {
  Divider,
  SettingsActionRow,
  SettingsCard,
  SettingsPanelSkeleton,
  SettingsSaveBar,
  SettingsSectionHeader,
  SettingsToggleRow,
} from './SettingsPrimitives'

type SecurityState = {
  two_factor_enabled: boolean
  login_alerts: boolean
}

export function SecuritySettingsPanel() {
  const { user, signOutAllDevices } = useAuth()
  const { profile, loading, updateProfile, refetch } = useProfile()
  const { confirm, dialog } = useConfirmDialog()
  const [deleteBusy, setDeleteBusy] = useState(false)

  const [security, setSecurity] = useState<SecurityState>({
    two_factor_enabled: false,
    login_alerts: true,
  })
  const [saved, setSaved] = useState<SecurityState>({
    two_factor_enabled: false,
    login_alerts: true,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false)
  const [twoFactorBusy, setTwoFactorBusy] = useState(false)
  const [twoFactorResending, setTwoFactorResending] = useState(false)
  const [twoFactorError, setTwoFactorError] = useState('')
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [passwordBusy, setPasswordBusy] = useState(false)

  const canChangePassword =
    Boolean(user?.email?.trim()) && Boolean(user?.identities?.some((i) => i.provider === 'email'))

  const dirty = useMemo(() => JSON.stringify(security) !== JSON.stringify(saved), [security, saved])

  useEffect(() => {
    if (!profile) return
    const next = {
      two_factor_enabled: profile.two_factor_enabled ?? false,
      login_alerts: profile.login_alerts ?? true,
    }
    setSecurity(next)
    setSaved(next)
  }, [profile])

  const closePasswordModal = () => {    setShowChangePasswordModal(false)
    setPasswordForm({ current: '', next: '', confirm: '' })
  }

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
      closePasswordModal()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not change password.')
    } finally {
      setPasswordBusy(false)
    }
  }

  const handleSecurityUpdate = async () => {
    setIsSaving(true)
    try {
      const enablingTwoFactor = security.two_factor_enabled && !saved.two_factor_enabled
      const disablingTwoFactor = !security.two_factor_enabled && saved.two_factor_enabled

      if (security.login_alerts !== saved.login_alerts) {
        const { error } = await updateProfile({ login_alerts: security.login_alerts })
        if (error) {
          toast.error(error)
          return
        }
      }

      if (enablingTwoFactor) {
        if (!user?.email?.trim()) {
          toast.error('Add an email address to enable two-factor authentication.')
          setSecurity((prev) => ({ ...prev, two_factor_enabled: false }))
          return
        }
        await apiClient.post<{ otp_sent: boolean }>('/api/auth/two-factor', { enabled: true })
        setTwoFactorError('')
        setShowTwoFactorModal(true)
        toast.success('Enter the code we sent to your email to turn on two-factor authentication.')
        setSaved((prev) => ({ ...prev, login_alerts: security.login_alerts }))
        return
      }

      if (disablingTwoFactor) {
        await apiClient.post<{ two_factor_enabled: boolean }>('/api/auth/two-factor', {
          enabled: false,
        })
      }

      toast.success('Security settings updated successfully!')
      setSaved(security)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update security settings')
    } finally {
      setIsSaving(false)
    }
  }

  const closeTwoFactorModal = () => {
    if (twoFactorBusy) return
    setShowTwoFactorModal(false)
    setTwoFactorError('')
    setSecurity((prev) => ({ ...prev, two_factor_enabled: saved.two_factor_enabled }))
  }

  const handleTwoFactorResend = async () => {
    if (twoFactorBusy || twoFactorResending) return
    setTwoFactorResending(true)
    setTwoFactorError('')
    try {
      await apiClient.post<{ otp_sent: boolean }>('/api/auth/two-factor', { enabled: true })
      toast.success('Verification code sent.')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not resend the code.'
      setTwoFactorError(message)
      toast.error(message)
    } finally {
      setTwoFactorResending(false)
    }
  }

  const handleTwoFactorConfirm = async (code: string) => {
    setTwoFactorBusy(true)
    setTwoFactorError('')
    try {
      await apiClient.post<{ two_factor_enabled: boolean }>('/api/auth/two-factor', {
        enabled: true,
        code,
      })
      await refetch()
      setSaved({
        two_factor_enabled: true,
        login_alerts: security.login_alerts,
      })
      setSecurity((prev) => ({ ...prev, two_factor_enabled: true }))
      setShowTwoFactorModal(false)
      toast.success('Two-factor authentication is on.')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not verify that code.'
      setTwoFactorError(message)
    } finally {
      setTwoFactorBusy(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteBusy) return

    const confirmed = await confirm({
      title: 'Delete account',
      message: 'Are you sure you want to delete your account? This action cannot be undone.',
      confirmLabel: 'Delete',
    })
    if (!confirmed) return

    const confirmation = prompt('Type "DELETE" to confirm account deletion:')
    if (confirmation !== 'DELETE') {
      toast.error('Account deletion cancelled')
      return
    }

    setDeleteBusy(true)
    try {
      await apiClient.delete<{ deleted: boolean; id: string }>('/api/users/me', {
        confirmation: 'DELETE',
      })
      toast.success('Your account has been deleted.')
      await signOutAllDevices()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete account')
    } finally {
      setDeleteBusy(false)
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
    } catch {
      toast.error('Failed to export data')
    }
  }

  if (loading && !profile) return <SettingsPanelSkeleton variant="security" />

  return (
    <>
      <div className="space-y-4">
        <SettingsCard>
          <SettingsSectionHeader title="Account" description="Sign-in details for this CribsTalk account." />
          <SettingsActionRow
            icon={Mail}
            title="Email address"
            description={user?.email || 'No email on this account'}
            action={<span className="text-sm text-content-tertiary">Signed in</span>}
          />
          <Divider />
          <SettingsActionRow
            icon={Lock}
            title="Change password"
            description={
              canChangePassword
                ? 'Update the password you use to sign in'
                : 'Only available for email and password accounts'
            }
            disabled={!canChangePassword}
            action={
              <button
                type="button"
                disabled={!canChangePassword}
                title={
                  canChangePassword ? undefined : 'Only available when you signed up with email and password.'
                }
                onClick={() => {
                  if (!canChangePassword) {
                    toast.error('Password change is only for accounts that use email sign-in.')
                    return
                  }
                  setShowChangePasswordModal(true)
                }}
                className="btn-secondary min-h-11 rounded-[14px] px-4 disabled:opacity-50"
              >
                Update
              </button>
            }
          />
        </SettingsCard>

        <SettingsCard>
          <SettingsSectionHeader
            title="Two-factor authentication"
            description="Add extra protection when someone tries to sign in."
          />
          <SettingsToggleRow
            icon={Shield}
            title="Two-factor authentication"
            description="Ask for a code sent to your email after you enter your password"
            checked={security.two_factor_enabled}
            onChange={(two_factor_enabled) => setSecurity({ ...security, two_factor_enabled })}
          />
        </SettingsCard>

        <SettingsCard>
          <SettingsSectionHeader title="Login activity" description="Get notified about new sign-ins." />
          <SettingsToggleRow
            icon={Lock}
            title="Login alerts"
            description="Get notified when someone logs into your account"
            checked={security.login_alerts}
            onChange={(login_alerts) => setSecurity({ ...security, login_alerts })}
          />
        </SettingsCard>

        <SettingsSaveBar dirty={dirty} saving={isSaving} onSave={handleSecurityUpdate} />

        <SettingsCard>
          <SettingsSectionHeader title="Your data" description="Download a copy of your CribsTalk information." />
          <SettingsActionRow
            icon={Download}
            title="Download my data"
            description="Export your account information as a file"
            action={
              <button
                type="button"
                onClick={handleDataDownload}
                className="btn-secondary min-h-11 rounded-[14px] px-4"
              >
                Download
              </button>
            }
          />
        </SettingsCard>

        <section className="overflow-hidden rounded-[16px] border border-red-200 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/20">
          <div className="border-b border-red-200 px-4 py-4 dark:border-red-900/40 sm:px-5">
            <h3 className="text-[15px] font-semibold text-danger">Danger zone</h3>
            <p className="mt-0.5 text-sm text-content-secondary">
              Deleting your account permanently removes your posts, comments, and personal data.
            </p>
          </div>
          <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
            <p className="text-sm leading-5 text-content-secondary">
              This cannot be undone. Make sure you’ve downloaded anything you want to keep.
            </p>
          </div>
          <div className="px-4 pb-4 sm:px-5">
            <button
              type="button"
              disabled={deleteBusy}
              onClick={handleDeleteAccount}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-red-300 bg-surface px-4 text-sm font-semibold text-danger transition-colors duration-200 hover:bg-red-50 disabled:opacity-50 sm:w-auto dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-4 w-4" />
              {deleteBusy ? 'Deleting…' : 'Delete account'}
            </button>
          </div>
        </section>
      </div>

      <ChangePasswordModal
        open={showChangePasswordModal}
        busy={passwordBusy}
        form={passwordForm}
        onChange={setPasswordForm}
        onClose={closePasswordModal}
        onSubmit={handleChangePasswordSubmit}
      />
      <TwoFactorSetupModal
        open={showTwoFactorModal}
        email={user?.email || ''}
        busy={twoFactorBusy}
        resending={twoFactorResending}
        error={twoFactorError}
        onClose={closeTwoFactorModal}
        onResend={() => void handleTwoFactorResend()}
        onSubmit={(code) => void handleTwoFactorConfirm(code)}
      />
      {dialog}
    </>
  )
}
