'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { Loader2, Monitor, Phone, Trash2 } from '@/shared/icons'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import {
  Divider,
  SettingsCard,
  SettingsSectionHeader,
} from './SettingsPrimitives'

type LinkedDevice = {
  deviceId: string
  deviceName: string
  platform: string
  deviceType: string
  createdAt: string
  lastSeenAt: string
  verified: boolean
  isCurrent: boolean
  identityChanged: boolean
  status: 'trusted' | 'untrusted'
}

function formatWhen(value: string, mode: 'relative' | 'date'): string {
  if (!value) return ''
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return mode === 'relative'
      ? formatDistanceToNow(date, { addSuffix: true })
      : format(date, 'MMM d, yyyy')
  } catch {
    return ''
  }
}

export function LinkedDevicesPanel({ enabled }: { enabled: boolean }) {
  const { user } = useAuth()
  const { confirm, dialog } = useConfirmDialog()
  const [devices, setDevices] = useState<LinkedDevice[]>([])
  const [loading, setLoading] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.id || !enabled) {
      setDevices([])
      return
    }
    setLoading(true)
    try {
      const engine = await import('@/lib/message-e2ee/engine')
      const rows = await engine.listLinkedDevices(user.id)
      setDevices(rows)
    } catch {
      setDevices([])
    } finally {
      setLoading(false)
    }
  }, [user?.id, enabled])

  useEffect(() => {
    void load()
  }, [load])

  const removeDevice = async (device: LinkedDevice) => {
    if (!user?.id || device.isCurrent) return
    const confirmed = await confirm({
      title: 'Remove this device?',
      message:
        'Are you sure you want to remove this device? It will no longer be able to access your encrypted conversations.',
      confirmLabel: 'Remove',
    })
    if (!confirmed) return

    setRemovingId(device.deviceId)
    try {
      const engine = await import('@/lib/message-e2ee/engine')
      await engine.removeLinkedDevice(user.id, device.deviceId)
      toast.success('Device removed')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove that device')
    } finally {
      setRemovingId(null)
    }
  }

  if (!enabled) return null

  return (
    <>
      <SettingsCard>
        <SettingsSectionHeader
          title="Linked devices"
          description="Browsers and phones that can read your end-to-end encrypted messages. Newly linked devices receive messages sent after they are linked."
        />
        <ul>
          {loading && devices.length === 0 ? (
            <li className="flex items-center gap-2 px-5 py-4 text-sm text-content-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading linked devices…
            </li>
          ) : devices.length === 0 ? (
            <li className="px-5 py-4 text-sm text-content-secondary">
              No encryption devices yet. Open Link a device to register this browser.
            </li>
          ) : (
            devices.map((device, index) => {
              const Icon = device.deviceType === 'mobile' || device.platform === 'ios' || device.platform === 'android'
                ? Phone
                : Monitor
              const lastActive = formatWhen(device.lastSeenAt, 'relative')
              const added = formatWhen(device.createdAt, 'date')
              return (
                <li key={device.deviceId}>
                  {index > 0 ? <Divider /> : null}
                  <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-surface-secondary text-content-secondary">
                        <Icon className="h-[18px] w-[18px]" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-medium text-content">
                          {device.deviceName}
                        </div>
                        <div className="mt-0.5 text-sm capitalize text-content-secondary">
                          {device.platform || 'web'}
                          {lastActive ? ` · Last active ${lastActive}` : null}
                        </div>
                        {added ? (
                          <div className="mt-0.5 text-xs text-content-tertiary">Added {added}</div>
                        ) : null}
                        <div className="mt-1 flex flex-wrap gap-2 text-xs font-medium">
                          {device.isCurrent ? (
                            <span className="text-primary">Current device</span>
                          ) : null}
                          <span className="text-content-secondary">
                            {device.status === 'trusted' || device.verified ? 'Trusted' : 'Untrusted'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {!device.isCurrent ? (
                      <button
                        type="button"
                        disabled={removingId === device.deviceId}
                        onClick={() => void removeDevice(device)}
                        className="btn-secondary inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[14px] px-4 text-sm disabled:opacity-50"
                      >
                        {removingId === device.deviceId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Remove
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </SettingsCard>
      {dialog}
    </>
  )
}
