'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Monitor, Shield, Trash2 } from '@/shared/icons'
import toast from 'react-hot-toast'
import { SettingsCard, SettingsSectionHeader } from './SettingsPrimitives'
import type { DeviceDirectoryEntry } from '@/lib/e2ee/types'

export function E2eeDevicesCard() {
  const [devices, setDevices] = useState<DeviceDirectoryEntry[]>([])
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const mod = await import('@/lib/e2ee/client')
      const [list] = await Promise.all([mod.listOwnDevices(), mod.ensureDevice()])
      setDevices(list)
      setCurrentId(mod.currentDeviceId())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load encryption devices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const remove = async (deviceId: number) => {
    setBusy(true)
    try {
      const mod = await import('@/lib/e2ee/client')
      await mod.revokeDevice(deviceId)
      toast.success(deviceId === currentId ? 'This device was removed and its keys were deleted' : 'Device removed')
      if (deviceId === currentId) {
        setDevices([])
        setCurrentId(null)
      } else {
        await load()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove device')
    } finally {
      setBusy(false)
    }
  }

  const saveBackup = async () => {
    setBusy(true)
    try {
      const mod = await import('@/lib/e2ee/client')
      await mod.createKeyBackup(passphrase)
      setPassphrase('')
      toast.success('Encrypted key backup saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save backup')
    } finally {
      setBusy(false)
    }
  }

  const restoreBackup = async () => {
    setBusy(true)
    try {
      const mod = await import('@/lib/e2ee/client')
      await mod.restoreKeyBackup(passphrase)
      setPassphrase('')
      toast.success('Keys restored on this device')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not restore backup')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsCard>
      <SettingsSectionHeader
        title="End-to-end encryption"
        description="Each browser is its own device. Private keys stay on the device. A removed device cannot decrypt new messages."
      />
      <div className="space-y-3 px-4 py-4 sm:px-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-content-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading devices
          </div>
        ) : devices.length === 0 ? (
          <p className="text-sm text-content-secondary">No active encryption devices.</p>
        ) : (
          devices.map((device) => (
            <div key={device.deviceId} className="flex items-start justify-between gap-3 rounded-xl border border-border-subtle px-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-content">
                  <Monitor className="h-4 w-4 shrink-0" />
                  <span className="truncate">{device.deviceName}</span>
                  {device.deviceId === currentId ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">This device</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-content-secondary">
                  Last active {new Date(device.lastActiveAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(device.deviceId)}
                className="inline-flex items-center gap-1 text-sm text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            </div>
          ))
        )}

        <div className="rounded-xl bg-surface-secondary p-3 text-sm leading-5 text-content-secondary">
          <div className="mb-1 flex items-center gap-2 font-medium text-content">
            <Shield className="h-4 w-4" />
            Key backup
          </div>
          Backup is optional and off until you save one. The backup is encrypted with your passphrase before upload.
          CribsTalk cannot recover the passphrase. Anyone who obtains the backup and guesses the passphrase can read
          messages that this device could read.
        </div>
        <input
          type="password"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          placeholder="Recovery passphrase"
          autoComplete="new-password"
          className="w-full rounded-xl border border-border px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || passphrase.length < 8} onClick={() => void saveBackup()} className="btn-secondary rounded-xl px-3 py-2 text-sm disabled:opacity-50">
            Save encrypted backup
          </button>
          <button type="button" disabled={busy || passphrase.length < 8} onClick={() => void restoreBackup()} className="btn-secondary rounded-xl px-3 py-2 text-sm disabled:opacity-50">
            Restore on this device
          </button>
        </div>
      </div>
    </SettingsCard>
  )
}
