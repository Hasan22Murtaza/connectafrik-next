'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiError } from '@/lib/api-client'
import { useConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { Trash2 } from '@/shared/icons'

export function DeleteAccountAction() {
  const { user, loading, signOutAllDevices } = useAuth()
  const { confirm, dialog } = useConfirmDialog()
  const [deleteBusy, setDeleteBusy] = useState(false)

  const handleDeleteAccount = async () => {
    if (deleteBusy) return

    const confirmed = await confirm({
      title: 'Delete account',
      message: 'Are you sure you want to delete your account? This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
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

  if (loading) {
    return (
      <div
        className="mt-4 h-12 w-full animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
        aria-hidden
      />
    )
  }

  if (!user) {
    return (
      <>
        <p>
          Sign in to the account you want to delete. You will come back to this page, and it will let
          you delete the account.
        </p>
        <div className="mt-4">
          <Link
            href="/signin?redirect=/delete-account"
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#F97316] px-4 text-sm font-semibold !text-white !no-underline transition-colors hover:bg-[#EA580C] hover:!text-white"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-4">
          If you can no longer sign in, email{' '}
          <a href="mailto:privacy@alloradigitalgroup.com">privacy@alloradigitalgroup.com</a> from
          the address on your account and ask us to delete it.
        </p>
      </>
    )
  }

  return (
    <>
      <p>
        You are signed in as <strong>{user.email || 'this account'}</strong>. Deleting it permanently
        closes the account and cannot be undone.
      </p>
      <p>
        Download a copy first if you want one:{' '}
        <Link href="/privacy/export-data">Download my information</Link>.
      </p>
      <div className="not-prose mt-4">
        <button
          type="button"
          disabled={deleteBusy}
          onClick={() => void handleDeleteAccount()}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:bg-slate-950 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          {deleteBusy ? 'Deleting…' : 'Delete account'}
        </button>
      </div>
      <p className="mt-4">
        If this is the wrong account, sign out and sign in with the one you want to delete. Need help
        from us instead? Email{' '}
        <a href="mailto:privacy@alloradigitalgroup.com">privacy@alloradigitalgroup.com</a>.
      </p>
      {dialog}
    </>
  )
}
